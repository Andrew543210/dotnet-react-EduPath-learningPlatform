const rules = {
  uk: new Intl.PluralRules('uk'),
  en: new Intl.PluralRules('en'),
}

export function pluralUk(n: number, one: string, few: string, many: string) {
  const form = rules.uk.select(n)
  const word = form === 'one' ? one : form === 'few' ? few : many
  return `${n} ${word}`
}

export function pluralEn(n: number, one: string, other: string) {
  return `${n} ${rules.en.select(n) === 'one' ? one : other}`
}
