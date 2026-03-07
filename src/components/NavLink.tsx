import { NavLink as RouterNavLink, NavLinkProps } from "react-router-dom";
import { cn } from "@/lib/utils";

interface CustomNavLinkProps extends NavLinkProps {
  activeClassName?: string;
}

/**
 * Um wrapper sobre o NavLink do react-router-dom que facilita 
 * a aplicação de classes CSS quando o link está ativo.
 */
export function NavLink({ 
  className, 
  activeClassName, 
  ...props 
}: CustomNavLinkProps) {
  return (
    <RouterNavLink
      // O 'end' evita que a rota "/" fique ativa quando o usuário está em sub-rotas
      end={props.to === "/"}
      className={({ isActive }) =>
        cn(
          "transition-all duration-200", // Transição suave para todos os links
          className, 
          isActive && activeClassName
        )
      }
      {...props}
    />
  );
}
