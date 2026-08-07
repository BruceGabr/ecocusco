-- Migración 002 · Retirada del rol `operador`
--
--   psql "$DATABASE_URL" -f database/migrations/002_eliminar_rol_operador.sql
--
-- El rol `operador` tenía exactamente los mismos permisos que `admin`, así que
-- se elimina y las cuentas existentes pasan a `admin`.
--
-- Por qué hace falta ejecutarla: `normalize_role()` devuelve `ciudadano` ante
-- cualquier rol que no reconozca. Sin esta conversión, un operador ya
-- registrado perdería todos sus permisos en silencio la próxima vez que
-- iniciara sesión.

begin;

update users
   set role = 'admin'
 where lower(trim(role)) = 'operador';

commit;

-- Comprobación (debe devolver 0 filas):
--   select id, name, email, role from users where lower(trim(role)) = 'operador';
