/**
 * dump-schema.js
 * Extrae el schema real de PostgreSQL y lo guarda en schema-actual.json
 *
 * Uso: node src/scripts/dump-schema.js
 *
 * Después del dump, haz commit del archivo generado:
 *   git add schema-actual.json
 *   git commit -m "Actualiza schema-actual.json"
 *   git push origin main
 */

import { query } from '../config/db.js';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = join(__dirname, '../../..', 'schema-actual.json');

try {
  console.log('\n📊 Extrayendo schema de la base de datos...\n');

  // ── 1. Columnas: tipo, nullable, default, GENERATED ──────────────────────
  const { rows: columnas } = await query(`
    SELECT
      c.table_name,
      c.column_name,
      c.data_type,
      c.udt_name,
      c.is_nullable,
      c.column_default,
      c.is_generated,
      c.generation_expression,
      c.character_maximum_length,
      c.numeric_precision,
      c.numeric_scale
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
    ORDER BY c.table_name, c.ordinal_position
  `);

  // ── 2. Constraints: PRIMARY KEY, UNIQUE, CHECK, FK ───────────────────────
  const { rows: constraints } = await query(`
    SELECT
      tc.table_name,
      tc.constraint_name,
      tc.constraint_type,
      kcu.column_name,
      ccu.table_name  AS foreign_table,
      ccu.column_name AS foreign_column,
      cc.check_clause
    FROM information_schema.table_constraints tc
    LEFT JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    LEFT JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
      AND tc.constraint_type = 'FOREIGN KEY'
    LEFT JOIN information_schema.check_constraints cc
      ON tc.constraint_name = cc.constraint_name
    WHERE tc.table_schema = 'public'
    ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name
  `);

  // ── 3. Índices (incluye únicos compuestos) ────────────────────────────────
  const { rows: indices } = await query(`
    SELECT
      t.relname  AS table_name,
      i.relname  AS index_name,
      ix.indisunique AS is_unique,
      array_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)) AS columns
    FROM pg_class t
    JOIN pg_index ix ON t.oid = ix.indrelid
    JOIN pg_class i  ON i.oid = ix.indexrelid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relkind = 'r'
    GROUP BY t.relname, i.relname, ix.indisunique
    ORDER BY t.relname, i.relname
  `);

  // ── 4. Organizar por tabla ────────────────────────────────────────────────
  const tablas = {};

  for (const col of columnas) {
    if (!tablas[col.table_name]) tablas[col.table_name] = { columnas: [], constraints: [], indices: [] };
    tablas[col.table_name].columnas.push({
      nombre:       col.column_name,
      tipo:         col.udt_name || col.data_type,
      nullable:     col.is_nullable === 'YES',
      default:      col.column_default,
      generada:     col.is_generated === 'ALWAYS',
      expresion:    col.generation_expression || null,
      max_length:   col.character_maximum_length,
    });
  }

  for (const con of constraints) {
    if (!tablas[con.table_name]) continue;
    tablas[con.table_name].constraints.push({
      nombre:          con.constraint_name,
      tipo:            con.constraint_type,
      columna:         con.column_name,
      tabla_foranea:   con.foreign_table  || null,
      columna_foranea: con.foreign_column || null,
      check:           con.check_clause   || null,
    });
  }

  for (const idx of indices) {
    const t = idx.table_name;
    if (!tablas[t]) continue;
    tablas[t].indices.push({
      nombre:    idx.index_name,
      unico:     idx.is_unique,
      columnas:  idx.columns,
    });
  }

  // ── 5. Resumen de columnas GENERATED (las más críticas) ──────────────────
  const generadas = [];
  for (const [tabla, info] of Object.entries(tablas)) {
    for (const col of info.columnas) {
      if (col.generada) {
        generadas.push({ tabla, columna: col.nombre, expresion: col.expresion });
      }
    }
  }

  const output = {
    generado_el: new Date().toISOString(),
    total_tablas: Object.keys(tablas).length,
    columnas_generadas: generadas,
    tablas,
  };

  writeFileSync(OUTPUT, JSON.stringify(output, null, 2), 'utf8');

  console.log(`✅ Schema guardado en: schema-actual.json`);
  console.log(`   Tablas encontradas: ${Object.keys(tablas).length}`);
  console.log(`   Columnas GENERATED: ${generadas.length}`);
  if (generadas.length > 0) {
    console.log('\n⚠️  Columnas GENERATED (nunca insertar directamente):');
    generadas.forEach(g => console.log(`   ${g.tabla}.${g.columna}${g.expresion ? ' = ' + g.expresion : ''}`));
  }
  console.log('\n📌 Haz commit del archivo generado:');
  console.log('   git add schema-actual.json');
  console.log('   git commit -m "Actualiza schema-actual.json"');
  console.log('   git push origin main\n');

} catch (err) {
  console.error('❌ Error:', err.message);
  process.exit(1);
}
process.exit(0);
