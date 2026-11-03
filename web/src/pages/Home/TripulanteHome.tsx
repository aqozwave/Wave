import { BookOpen, GraduationCap, User } from "lucide-react";
import { Link } from "react-router";
import { Topbar } from "../../components/Topbar/Topbar";
import { UserMenu } from "../../components/UserMenu/UserMenu";
import { userHasPermission } from "../../lib/api/auth";
import { useAuth } from "../../lib/auth/AuthContext";

/** Capitaliza el primer carácter del nombre. */
function capitalizeName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/**
 * Home del tripulante (Figma T1–T3 · entrada mínima).
 * Sin Panel OMI de empresa; atajos a lo que su rol puede ver.
 */
export function TripulanteHome() {
  const { user } = useAuth();
  const name = user ? capitalizeName(user.firstName) : "usuario";
  const canCursos = userHasPermission(user, "cursos.assignments", "read");
  const canLibreta = userHasPermission(user, "cursos.libretas", "read");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Topbar breadcrumb="Inicio" actions={<UserMenu />} />
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-5 lg:px-8">
        <div>
          <h1 className="m-0 text-[20px] font-semibold text-[var(--color-nachipa-title)]">
            Hola, {name}
          </h1>
          <p className="m-0 mt-1 text-[13px] text-[var(--color-nachipa-secondary)]">
            Tus cursos, libreta y perfil
            {user?.locationName ? ` · ${user.locationName}` : ""}.
          </p>
        </div>

        <ul className="m-0 grid max-w-[720px] list-none grid-cols-1 gap-3 p-0 sm:grid-cols-3">
          {canCursos ? (
            <li>
              <Link
                to="/cursos/tripulacion"
                className="flex h-full flex-col gap-2 rounded-[14px] border border-[var(--color-tremor-border)] bg-[var(--color-tremor-background)] p-4 no-underline"
              >
                <GraduationCap
                  size={20}
                  strokeWidth={1.5}
                  className="text-[var(--color-nav-icon)]"
                  aria-hidden
                />
                <p className="m-0 text-[15px] font-semibold text-[var(--color-nachipa-title)]">
                  Mis cursos
                </p>
                <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
                  Vigencias y asignaciones OMI.
                </p>
              </Link>
            </li>
          ) : null}
          {canLibreta ? (
            <li>
              <Link
                to="/cursos/vencimientos"
                className="flex h-full flex-col gap-2 rounded-[14px] border border-[var(--color-tremor-border)] bg-[var(--color-tremor-background)] p-4 no-underline"
              >
                <BookOpen
                  size={20}
                  strokeWidth={1.5}
                  className="text-[var(--color-nav-icon)]"
                  aria-hidden
                />
                <p className="m-0 text-[15px] font-semibold text-[var(--color-nachipa-title)]">
                  Mi libreta
                </p>
                <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
                  Estado de la libreta de embarque.
                </p>
              </Link>
            </li>
          ) : null}
          <li className="flex flex-col gap-2 rounded-[14px] border border-[var(--color-tremor-border)] bg-[var(--color-tremor-background)] p-4">
            <User
              size={20}
              strokeWidth={1.5}
              className="text-[var(--color-nav-icon)]"
              aria-hidden
            />
            <p className="m-0 text-[15px] font-semibold text-[var(--color-nachipa-title)]">
              Mi perfil
            </p>
            <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
              Datos y seguridad desde el menú de usuario (arriba a la derecha).
            </p>
          </li>
        </ul>
      </div>
    </div>
  );
}
