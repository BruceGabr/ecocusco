/**
 * Validación de formularios con mensajes propios.
 *
 * El navegador dibuja su burbuja nativa ("Completa este campo") fuera del
 * documento, así que no admite ningún estilo. La solución es marcar el
 * formulario como `noValidate` y leer nosotros la Constraint Validation API:
 * se conserva toda la lógica de validación del navegador (required, type,
 * minLength, min/max) y solo se sustituye su interfaz.
 */

export type FieldErrors = Record<string, string>;

function messageFor(field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): string {
  const validity = field.validity;

  if (validity.valueMissing) return "Este campo es obligatorio";
  if (validity.typeMismatch) {
    if (field.getAttribute("type") === "email") return "Introduce un correo electrónico válido";
    return "El formato no es válido";
  }
  if (validity.tooShort) {
    const min = field.getAttribute("minLength") ?? field.getAttribute("minlength");
    return min ? `Debe tener al menos ${min} caracteres` : "El valor es demasiado corto";
  }
  if (validity.tooLong) {
    const max = field.getAttribute("maxLength") ?? field.getAttribute("maxlength");
    return max ? `No puede superar los ${max} caracteres` : "El valor es demasiado largo";
  }
  if (validity.rangeUnderflow) return `El valor mínimo es ${field.getAttribute("min")}`;
  if (validity.rangeOverflow) return `El valor máximo es ${field.getAttribute("max")}`;
  if (validity.stepMismatch) return "El valor no es válido";
  if (validity.patternMismatch) return "El formato no es válido";
  return "Revisa este campo";
}

/**
 * Recorre los campos del formulario y devuelve los errores indexados por `id`
 * (o por `name` si el campo no tiene id). Devuelve un objeto vacío si todo es válido.
 */
export function collectErrors(form: HTMLFormElement): FieldErrors {
  const errors: FieldErrors = {};
  const fields = Array.from(form.elements) as Array<HTMLElement>;

  fields.forEach(element => {
    if (
      !(element instanceof HTMLInputElement) &&
      !(element instanceof HTMLSelectElement) &&
      !(element instanceof HTMLTextAreaElement)
    ) {
      return;
    }
    if (element.disabled || element.type === "submit" || element.type === "button") return;
    if (element.validity.valid) return;

    const key = element.id || element.name;
    if (key && !errors[key]) errors[key] = messageFor(element);
  });

  return errors;
}

/** Props de accesibilidad para un campo con error: lo marca y lo enlaza a su mensaje. */
export function errorProps(fieldId: string, errors: FieldErrors) {
  const message = errors[fieldId];
  if (!message) return {};
  return { "aria-invalid": true as const, "aria-describedby": `${fieldId}-error`, className: "invalid" };
}
