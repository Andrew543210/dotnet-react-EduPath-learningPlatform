import { checkExpiry, detectBrand, formatCardNumber, formatExpiry, passesLuhn, testCards } from './card'

describe('card helpers', () => {
  it('validates numbers with the Luhn checksum', () => {
    expect(passesLuhn('4242 4242 4242 4242')).toBe(true)
    expect(passesLuhn('4242 4242 4242 4241')).toBe(false)
    expect(passesLuhn('1234')).toBe(false)
  })

  it('accepts every sandbox test card', () => {
    for (const card of testCards) expect(passesLuhn(card.number)).toBe(true)
  })

  it('detects the card brand', () => {
    expect(detectBrand('4242')).toBe('visa')
    expect(detectBrand('5555 5555')).toBe('mastercard')
    expect(detectBrand('2221 00')).toBe('mastercard')
    expect(detectBrand('3782')).toBe('amex')
    expect(detectBrand('9999')).toBe('unknown')
  })

  it('formats the number in groups of four and drops non-digits', () => {
    expect(formatCardNumber('4242-4242a42424242')).toBe('4242 4242 4242 4242')
    expect(formatCardNumber('42424')).toBe('4242 4')
  })

  it('formats expiry as MM/YY', () => {
    expect(formatExpiry('1228')).toBe('12/28')
    expect(formatExpiry('12/2')).toBe('12/2')
    expect(formatExpiry('1')).toBe('1')
  })

  it('treats a card as valid until the end of its month', () => {
    const now = new Date(2026, 10, 15)
    expect(checkExpiry('11/26', now)).toBeNull()
    expect(checkExpiry('10/26', now)).toBe('expired')
    expect(checkExpiry('13/27', now)).toBe('format')
    expect(checkExpiry('1227', now)).toBe('format')
  })
})
