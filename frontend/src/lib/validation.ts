import { z } from 'zod'
import type { Messages } from '@/i18n/uk'

export const passwordSchema = (t: Messages) =>
  z
    .string()
    .min(8, t.validation.passwordMin)
    .regex(/\p{L}/u, t.validation.passwordLetter)
    .regex(/\d/, t.validation.passwordDigit)
