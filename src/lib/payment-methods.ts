// Card is always offered and isn't a choice — this is just the optional
// extras a restaurant can turn on/off from Ajustes, same pattern as
// dietary tags (see src/lib/dietary-tags.ts).
export const OPTIONAL_PAYMENT_METHODS = [
  { value: 'bizum', label: 'Bizum', euroOnly: true },
  { value: 'revolut_pay', label: 'Revolut Pay', euroOnly: true },
  { value: 'paypal', label: 'PayPal', euroOnly: false },
] as const

export type OptionalPaymentMethod = (typeof OPTIONAL_PAYMENT_METHODS)[number]['value']
