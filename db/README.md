# Base de datos

`migraciones/001_esquema.sql` es el estado completo del schema `setter` (ya aplicado en Supabase mediante migraciones sucesivas). Sirve para recrear la base de datos desde cero, por ejemplo al pasar a un proyecto propio de Supabase, o para probar en local.

Los cambios nuevos se añaden como `002_...sql`, `003_...sql`, etc.
