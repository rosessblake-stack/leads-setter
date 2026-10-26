# Base de datos

`migraciones/` contiene el schema `setter` en orden: `001_esquema.sql` (estado base, ya con el acceso al panel) y las siguientes (`002_...`, `003_...`) se aplican después, en orden. Sirven para recrear la base de datos desde cero (por ejemplo, al pasar a un proyecto propio de Supabase) o para probar en local.

Los cambios nuevos se añaden como un archivo nuevo con el siguiente número.
