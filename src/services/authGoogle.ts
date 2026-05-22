export function useGoogleSignIn() {
  return { request: null, response: null, promptAsync: async () => ({ type: 'cancel' }) };
}

export async function exchangeForJwt(): Promise<never> {
  throw new Error('Login Google removido. Use login próprio.');
}
