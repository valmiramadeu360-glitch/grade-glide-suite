import { Navigate } from "react-router-dom";

/**
 * Componente utilitário de redirecionamento.
 * Garante que qualquer acesso à raiz ou rotas indefinidas indexadas
 * levem o usuário diretamente para o Dashboard Acadêmico.
 */
const Index = () => {
  return <Navigate to="/" replace />;
};

export default Index;
