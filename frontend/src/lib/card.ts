export const digitsOnly = (value: string) => value.replace(/\D/g, '')

export function passesLuhn(number: string) {
  const digits = digitsOnly(number)
  if (digits.length < 12 || digits.length > 19) return false
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i])
    if (i % 2 === 1) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  return sum % 10 === 0
}

export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'unknown'

export function detectBrand(number: string): CardBrand {
  const d = digitsOnly(number)
  if (/^4/.test(d)) return 'visa'
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(d)) return 'mastercard'
  if (/^3[47]/.test(d)) return 'amex'
  return 'unknown'
}

export function formatCardNumber(value: string) {
  return digitsOnly(value)
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, '$1 ')
}

export function formatExpiry(value: string) {
  const d = digitsOnly(value).slice(0, 4)
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d
}

export type ExpiryProblem = 'format' | 'expired' | null

export function checkExpiry(value: string, now = new Date()): ExpiryProblem {
  const match = /^(\d{2})\/(\d{2})$/.exec(value)
  if (!match) return 'format'
  const month = Number(match[1])
  if (month < 1 || month > 12) return 'format'
  const year = 2000 + Number(match[2])
  return new Date(year, month, 1) <= new Date(now.getFullYear(), now.getMonth(), 1) ? 'expired' : null
}

export const testCards = [
  { number: '4242 4242 4242 4242', kind: 'success' as const },
  { number: '4000 0000 0000 0002', kind: 'declined' as const },
  { number: '4000 0000 0000 9995', kind: 'funds' as const },
]
