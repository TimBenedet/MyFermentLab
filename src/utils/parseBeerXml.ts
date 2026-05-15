import type { Recipe, RecipeIngredient, RecipeStep, IngredientType } from '../types/brewing'

function getText(parent: Element, tag: string): string {
  return parent.querySelector(tag)?.textContent?.trim() ?? ''
}

function getFloat(parent: Element, tag: string, fallback = 0): number {
  const v = parseFloat(getText(parent, tag))
  return isNaN(v) ? fallback : v
}

function generateId(prefix: string): string {
  return `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

// Convert SRM to rough EBC (1 SRM ≈ 1.97 EBC) — BeerXML COLOR is in SRM
function colorToSrm(color: number): number {
  return Math.round(color)
}

// Tinseth IBU estimate for a single hop addition
function tinsethIbu(og: number, boilVolume: number, alphaAcid: number, weightKg: number, timeMin: number): number {
  const bignessFactor = 1.65 * Math.pow(0.000125, og - 1)
  const timeFactor = (1 - Math.exp(-0.04 * timeMin)) / 4.15
  const utilization = bignessFactor * timeFactor
  return (utilization * alphaAcid / 100 * weightKg * 1000000) / (boilVolume * 10)
}

export function parseBeerXml(xmlText: string): Recipe[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, 'application/xml')

  const parseError = doc.querySelector('parsererror')
  if (parseError) throw new Error('Invalid XML')

  const recipeEls = Array.from(doc.querySelectorAll('RECIPE'))

  return recipeEls.map(el => {
    const name = getText(el, 'NAME') || 'Recette importée'
    const batchSize = getFloat(el, 'BATCH_SIZE', 20)
    const boilSize = getFloat(el, 'BOIL_SIZE', batchSize * 1.25)
    const ogRaw = getFloat(el, 'OG', 1.050)
    const fgRaw = getFloat(el, 'FG', 1.010)
    const og = ogRaw > 1 ? ogRaw : 1 + ogRaw / 1000
    const fg = fgRaw > 1 ? fgRaw : 1 + fgRaw / 1000
    const abv = Math.round((og - fg) * 131.25 * 10) / 10
    const style = getText(el, 'STYLE > NAME') || getText(el, 'TYPE') || 'Beer'
    const primaryTemp = getFloat(el, 'PRIMARY_TEMP', 19)

    const ingredients: RecipeIngredient[] = []

    // Fermentables → grain / autre
    Array.from(el.querySelectorAll('FERMENTABLES > FERMENTABLE')).forEach(f => {
      const ferType = getText(f, 'TYPE').toLowerCase()
      const type: IngredientType = ferType === 'adjunct' || ferType === 'sugar' || ferType === 'extract' ? 'autre' : 'grain'
      const amountKg = getFloat(f, 'AMOUNT')
      ingredients.push({
        id: generateId('ing-'),
        name: getText(f, 'NAME'),
        type,
        quantity: Math.round(amountKg * 1000) / 1000,
        unit: 'kg',
        addAt: type === 'grain' ? 'Empâtage' : 'Ébullition',
      })
    })

    // Hops → houblon
    let totalIbu = 0
    Array.from(el.querySelectorAll('HOPS > HOP')).forEach(h => {
      const amountKg = getFloat(h, 'AMOUNT')
      const amountG = Math.round(amountKg * 1000 * 10) / 10
      const use = getText(h, 'USE').toLowerCase()
      const timeMin = getFloat(h, 'TIME')
      const alpha = getFloat(h, 'ALPHA')

      let addAt = 'Ébullition'
      if (use === 'dry hop') addAt = `Dry hop J5`
      else if (use === 'whirlpool' || use === 'aroma') addAt = 'Whirlpool'
      else if (use === 'first wort') addAt = 'Premier moût'
      else if (timeMin > 0) addAt = `Ébullition ${timeMin}min`

      if (use === 'boil' && timeMin > 0) {
        totalIbu += tinsethIbu(og, boilSize, alpha, amountKg, timeMin)
      }

      ingredients.push({
        id: generateId('ing-'),
        name: getText(h, 'NAME'),
        type: 'houblon',
        quantity: amountG,
        unit: 'g',
        addAt,
      })
    })

    // Yeasts → levure
    Array.from(el.querySelectorAll('YEASTS > YEAST')).forEach(y => {
      const amountRaw = getFloat(y, 'AMOUNT', 0.035)
      const form = getText(y, 'FORM').toLowerCase()
      const unit = form === 'dry' ? 'pkt' : 'L'
      const quantity = form === 'dry' ? 1 : Math.round(amountRaw * 1000) / 1000
      ingredients.push({
        id: generateId('ing-'),
        name: getText(y, 'NAME'),
        type: 'levure',
        quantity,
        unit,
        addAt: 'Fermentation',
      })
    })

    // Miscs → autre
    Array.from(el.querySelectorAll('MISCS > MISC')).forEach(m => {
      const amountRaw = getFloat(m, 'AMOUNT')
      const use = getText(m, 'USE').toLowerCase()
      const timeMin = getFloat(m, 'TIME')

      let addAt = 'Ébullition'
      if (use === 'boil' && timeMin > 0) addAt = `Ébullition ${timeMin}min`
      else if (use === 'primary') addAt = 'Fermentation primaire'
      else if (use === 'secondary') addAt = 'Fermentation secondaire'
      else if (use === 'mash') addAt = 'Empâtage'

      // Amount can be g or mL — keep as-is, use g if < 10, else g
      const quantity = amountRaw > 10 ? Math.round(amountRaw) : Math.round(amountRaw * 10) / 10
      const unit = amountRaw > 10 ? 'g' : 'g'

      ingredients.push({
        id: generateId('ing-'),
        name: getText(m, 'NAME'),
        type: 'autre',
        quantity,
        unit,
        addAt,
      })
    })

    // Steps from MASH_STEPS + fermentation
    const steps: RecipeStep[] = []

    // Mash steps → day 0
    Array.from(el.querySelectorAll('MASH_STEPS > MASH_STEP')).forEach((s, i) => {
      const stepTemp = getFloat(s, 'STEP_TEMP')
      const stepTime = getFloat(s, 'STEP_TIME')
      steps.push({
        id: generateId('step-'),
        description: getText(s, 'NAME') || `Empâtage ${i + 1}`,
        day: 0,
        done: false,
        durationMinutes: stepTime || undefined,
        targetTemp: stepTemp || undefined,
      })
    })

    // Boil step → day 0
    const boilTime = getFloat(el, 'BOIL_TIME', 60)
    if (boilTime > 0) {
      steps.push({
        id: generateId('step-'),
        description: `Ébullition`,
        day: 0,
        done: false,
        durationMinutes: boilTime,
      })
    }

    // Primary fermentation → day 1
    steps.push({
      id: generateId('step-'),
      description: 'Fermentation primaire',
      day: 1,
      done: false,
      targetTemp: primaryTemp || undefined,
    })

    // SRM from fermentables COLOR fields (weighted average)
    const fermentableEls = Array.from(el.querySelectorAll('FERMENTABLES > FERMENTABLE'))
    const totalWeight = fermentableEls.reduce((s, f) => s + getFloat(f, 'AMOUNT'), 0)
    const mcu = fermentableEls.reduce((s, f) => {
      return s + (getFloat(f, 'COLOR') * getFloat(f, 'AMOUNT') / batchSize)
    }, 0)
    // Morey formula: SRM = 1.4922 × MCU^0.6859
    const srm = totalWeight > 0 ? Math.round(1.4922 * Math.pow(mcu, 0.6859)) : 10

    return {
      id: generateId('recipe-'),
      projectType: 'beer',
      name,
      style,
      batchSize,
      og,
      fg,
      abv,
      ibu: Math.round(totalIbu),
      srm: colorToSrm(srm),
      ingredients,
      steps,
      createdAt: Date.now(),
    }
  })
}
