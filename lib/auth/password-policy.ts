export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export function getPasswordPolicyError(password: unknown) {
  if (typeof password !== "string") return "Escribe una contraseña válida.";
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    return `La contraseña debe tener entre ${PASSWORD_MIN_LENGTH} y ${PASSWORD_MAX_LENGTH} caracteres.`;
  }
  if (!/[a-z]/.test(password)) return "La contraseña debe incluir una minúscula.";
  if (!/[A-Z]/.test(password)) return "La contraseña debe incluir una mayúscula.";
  if (!/[0-9]/.test(password)) return "La contraseña debe incluir un número.";
  if (!/[^a-zA-Z0-9]/.test(password)) return "La contraseña debe incluir un símbolo.";
  return null;
}
