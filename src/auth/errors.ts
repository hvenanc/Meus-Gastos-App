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
      "A senha não atende à política da sua conta. Use uma senha mais forte.",
    "auth/password-does-not-meet-requirements":
      "A senha não atende à política de segurança da sua conta.",
    "auth/too-many-requests":
      "Muitas tentativas. Aguarde um pouco e tente novamente.",
    "auth/network-request-failed":
      "Sem conexão. Verifique sua internet e tente novamente.",
    "auth/operation-not-allowed":
      "O acesso por e-mail está temporariamente indisponível. Tente novamente mais tarde.",
    "auth/invalid-api-key":
      "O serviço de acesso está indisponível. Tente novamente mais tarde.",
    "auth/user-disabled": "Esta conta foi desativada.",
    "auth/unauthorized-domain": "O acesso não está disponível neste endereço.",
    "auth/configuration-not-found":
      "O serviço de acesso está indisponível. Tente novamente mais tarde.",
  };
  return messages[code ?? ""] ?? "Não foi possível concluir. Tente novamente.";
}
