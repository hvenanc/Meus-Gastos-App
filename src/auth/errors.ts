export function authError(error: unknown) {
  const code = (error as { code?: string })?.code;
  const messages: Record<string, string> = {
    "auth/invalid-email": "Informe um e-mail válido.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/wrong-password": "E-mail ou senha incorretos.",
    "auth/user-not-found": "E-mail ou senha incorretos.",
    "auth/email-already-in-use":
      "Este e-mail já tem uma conta. Entre ou recupere sua senha.",
    "auth/weak-password":
      "A senha não atende à política do projeto. Use uma senha mais forte.",
    "auth/password-does-not-meet-requirements":
      "A senha não atende à política de segurança do projeto.",
    "auth/too-many-requests":
      "Muitas tentativas. Aguarde um pouco e tente novamente.",
    "auth/network-request-failed":
      "Sem conexão. Verifique sua internet e tente novamente.",
    "auth/operation-not-allowed":
      "Ative o provedor E-mail/senha no Firebase Authentication.",
    "auth/invalid-api-key":
      "Confira a configuração do Firebase no arquivo .env.",
    "auth/user-disabled": "Esta conta foi desativada.",
    "auth/unauthorized-domain":
      "Autorize este domínio nas configurações do Firebase Authentication.",
    "auth/configuration-not-found":
      "Configure o Firebase Authentication no console do projeto.",
  };
  return messages[code ?? ""] ?? "Não foi possível concluir. Tente novamente.";
}
