'use strict'

const toNumberMaybe = x => +x === +x ? +x : x
const toValue = el => toNumberMaybe(el.dataset.v || el.textContent)
const lerp = (a, b, t) => (1 - t) * a + t * b

const colsDescend = Array.from(document.querySelector('.weapon-table tr.secondary')?.children || [], th => th.classList.contains('descending'))
const stateLinks = Array.from(document.querySelectorAll('#wdef-grid, #wdef-list, #wdef-table'))
for (const el of stateLinks) {
  el.setAttribute('href', el.getAttribute('href').split('#')[0] + location.hash)
}
const withState = f => {
  const params = new URLSearchParams(location.hash.slice(1))
  f(params)
  const frag = '#' + params
  try {
    // firefox throttles this
    history.replaceState(null, '', frag)
  } catch (_) {}
  for (const el of stateLinks) {
    el.setAttribute('href', el.getAttribute('href').split('#')[0] + frag)
  }
}

const sortBy = (th, descending, soft = false) => {
  if (!th) return
  const hrow = th.parentElement
  const i = Array.from(hrow.children).indexOf(th)
  const table = th.closest('table')
  const tbody = table.querySelector('tbody')
  const rows = Array.from(tbody.children)
  if (th.classList.contains('active')) {
    th.classList.toggle('descending')
  } else {
    for (const child of hrow.children) child.classList.remove('active')
    th.classList.add('active')
  }
  if (descending != null) {
    th.classList.toggle('descending', !!descending)
  }
  const sign = th.classList.contains('descending') ? -1 : 1
  rows.sort((ra, rb) => {
    const a = toValue(ra.children[i])
    const b = toValue(rb.children[i])
    return sign * (((typeof a === 'number') - (typeof b === 'number') || (typeof a === 'number' ? a - b : a.localeCompare(b))) || ra.dataset.title.localeCompare(rb.dataset.title))
  })
  tbody.append(...rows)
  if (!soft) {
    withState(params => {
      params.set('sort', th.dataset.id)
      if (sign === -1) {
        params.set('descending', '')
      } else {
        params.delete('descending')
      }
    })
  }
}
const resort = () => {
  const th = document.querySelector('th.active')
  if (th) sortBy(th, th.classList.contains('descending'), true)
}
const filterEls = key =>
  Array.from(document.querySelectorAll(`.filters a[data-${key}]`))
const selectEl = key =>
  document.querySelector(`select[data-id=${key}]`)

const activeEls = els =>
  els.filter(el => el.classList.contains('active'))

const filterState = key => {
  const select = selectEl(key)
  return select ? select.value ? [select.value] : Array.from(select.options, x => x.value).filter(x => x) : activeEls(filterEls(key)).map(el => el.dataset[key])
}
const setFilterState = (key, values) => {
  const select = selectEl(key)
  if (select) {
    select.value = values[0] || ''
    return
  }
  for (const el of filterEls(key)) {
    el.classList.toggle('active', values.length === 0 || el.dataset[key].split(',').every(v => values.includes(v)))
  }
}

const targetRangeEl = document.querySelector('.filters .range input')
const refilter = () => {
  const filtered = document.querySelector('.filtered')
  if (!filtered) return

  const isTable = filtered.localName === 'tbody'
  const qualities = filterState('quality')
  const classes = filterState('class')
  const allClasses = classes.length === 0
  const firemodes = filterState('firemodes').join(',').split(',')
  const types = filterState('type')
  const suppresseds = filterState('suppressed')
  const uniques = filterState('unique')
  const allFiremodes = firemodes.length === 4
  const rangeLabel = document.querySelector('.filters .range')
  const activeEl = rangeLabel?.querySelector('.active')
  const targetRange = +targetRangeEl?.value || 0
  if (rangeLabel) {
    rangeLabel.querySelector('.text').textContent = `${Math.round(targetRange/100)} m`
    activeEl.style.width = `${(targetRange - targetRangeEl.min) / (targetRangeEl.max - targetRangeEl.min) * 100}%`
  }

  const minmax = Array.from(colsDescend, desc => {
    return {minOut: NaN, min: NaN, avg: 0, max: NaN, maxOut: NaN, desc}
  })
  let count = 0
  for (const el of filtered.children) {
    const show = qualities.includes(el.dataset.quality) && types.includes(el.dataset.type) && suppresseds.includes(el.dataset.suppressed) && uniques.includes(el.dataset.unique) && (allFiremodes || firemodes.some(f => el.dataset.firemodes.includes(f))) && classes.includes(el.dataset.class)
    el.style.display = show ? '' : 'none'

    if (rangeLabel) {
      const damageMelee = +el.dataset.damagemelee
      const damageMeleeAi = +el.dataset.damagemeleeai
      const damagePerShot = +el.dataset.damage
      const damagePerShotAiEnemy = +el.dataset.damageenemy
      const damagePerShotAiHeister = +el.dataset.damageheister
      const mulDamageMin = +el.dataset.muldamagemin
      const mulDamageMinAi = +el.dataset.muldamageminai
      const range = +el.dataset.range
      const rangeMax = +el.dataset.rangemax
      const rangeMelee = +el.dataset.rangemelee
      const rangeAi = +el.dataset.rangeai
      const rangeMaxAi = +el.dataset.rangemaxai
      const rangeMeleeAi = +el.dataset.rangemeleeai
      const nominalMagazine = +el.dataset.magazine
      const ammoCost = +el.dataset.ammocost
      const magazine = Math.ceil(nominalMagazine / (ammoCost || 1))
      const isMelee = el.dataset.class === 'C_Melee'
      const rpsSust = isMelee ? +el.dataset.rpssustmelee : +el.dataset.rpssust
      const rpsInst = isMelee ? +el.dataset.rpsinstmelee : +el.dataset.rpsinst
      const rpsSustAi = isMelee ? +el.dataset.rpssustmelee/*ai*/ : +el.dataset.rpssustai
      const rpsInstAi = isMelee ? +el.dataset.rpsinstmelee/*ai*/ : +el.dataset.rpsinstai

      const trf = isMelee ? 1. : Math.max(0, Math.min(1, (targetRange - range) / (rangeMax - range || 0.001)))
      const damage = isMelee ? damageMelee * (targetRange <= rangeMelee) : damagePerShot * lerp(1, mulDamageMin, trf)
      const dim = damage * magazine
      const trfAi = isMelee ? 1. : Math.max(0, Math.min(1, (targetRange - rangeAi) / (rangeMaxAi - rangeAi || 0.001)))
      const damageAiEnemy = isMelee ? damageMeleeAi * (targetRange <= rangeMelee) : damagePerShotAiEnemy * lerp(1, mulDamageMinAi, trf)
      const damageAiHeister = isMelee ? damageMeleeAi * (targetRange <= rangeMelee) : damagePerShotAiHeister * lerp(1, mulDamageMinAi, trf)

      const dpsInst = rpsInst * damage
      const dps = rpsSust * damage
      const dpsAiEnemy = rpsSustAi * damageAiEnemy
      const dpsAiHeister = rpsSustAi * damageAiHeister
      const dpsInstAiEnemy = rpsInstAi * damageAiEnemy
      const dpsInstAiHeister = rpsInstAi * damageAiHeister

      const damageEl = el.querySelector('.damage')
      if (damageEl) {
        damageEl.dataset.v = damage
        damageEl.textContent = damage.toFixed(0)
      }
      const damageAiEnemyEl = el.querySelector('.damage-enemy')
      if (damageAiEnemyEl) damageAiEnemyEl.textContent = damageAiEnemy.toFixed(0)
      const damageAiHeisterEl = el.querySelector('.damage-heister')
      if (damageAiHeisterEl) damageAiHeisterEl.textContent = damageAiHeister.toFixed(0)
      const dpsAiHeisterEl = el.querySelector('.dps-heister')
      if (dpsAiHeisterEl) dpsAiHeisterEl.textContent = dpsAiHeister.toFixed(0)
      const dpsAiEnemyEl = el.querySelector('.dps-enemy')
      if (dpsAiEnemyEl) dpsAiEnemyEl.textContent = dpsAiEnemy.toFixed(0)
      const dpsInstAiHeisterEl = el.querySelector('.dps-inst-heister')
      if (dpsInstAiHeisterEl) dpsInstAiHeisterEl.textContent = dpsInstAiHeister.toFixed(0)
      const dpsAiInstEnemyEl = el.querySelector('.dps-inst-enemy')
      if (dpsAiInstEnemyEl) dpsAiInstEnemyEl.textContent = dpsInstAiEnemy.toFixed(0)
      const dimEl = el.querySelector('.dim')
      if (dimEl) {
        dimEl.dataset.v = isMelee || ammoCost === 0 ? 0 : dim
        dimEl.textContent = isMelee || ammoCost === 0 ? '' : dim.toFixed(0)
      }
      const dpsInstEl = el.querySelector('.dps-inst')
      if (dpsInstEl) dpsInstEl.textContent = dpsInst.toFixed(0)
      const dpsEl = el.querySelector('.dps')
      if (dpsEl) dpsEl.textContent = dps.toFixed(0)
    }
    if (show && isTable) {
      ++count
      let j = 0
      for (const td of el.children) {
        const mm = minmax[j++]
        const v = toValue(td)
        if (mm.minOut !== mm.minOut) {
          mm.minOut = mm.maxOut = v
        } else {
          if (v <= mm.minOut) {
            mm.min = mm.minOut
            mm.minOut = v
          } else if (v <= mm.min) {
            mm.min = v
          }
          if (v >= mm.maxOut) {
            mm.max = mm.maxOut
            mm.maxOut = v
          } else if (v >= mm.max) {
            mm.max = v
          }
        }
        mm.avg += v
      }
    }
  }
  if (!isTable) return
  for (const mm of minmax) {
    mm.avg /= count
  }
  for (const el of filtered.children) {
    if (el.style.display !== 'none') {
      let j = 0
      for (const td of el.children) {
        const mm = minmax[j++]
        const v = toValue(td)
        // const f_ = (v - mm.min) * 2 / (mm.max - mm.min) - 1
        const f_ = v < mm.avg ? (v - mm.avg) / (mm.avg - mm.min) : (v - mm.avg) / (mm.max - mm.avg)
        // const f = (mm.desc ? 1 : -1) * Math.sign(f_) * Math.sqrt(Math.abs(f_))
        const f = (mm.desc ? 1 : -1) * f_
        // td.style.color = `oklch(90% ${Math.abs(f) * 0.06} ${90 + (f > 0) * 180})`
        td.style.color = `oklch(90% ${Math.min(1, Math.abs(f)) * 0.07} ${f < 0 ? 20 : 140})`
        // td.style.color = `oklch(90% ${Math.min(1, Math.abs(f)) * 0.06} ${f < 0 ? 100 : 230})`
        // td.dataset.min = mm.min
        // td.dataset.max = mm.max
      }
    }
  }
}
const filterBy = (a, on) => {
  const key = Object.keys(a.dataset)[0]
  const els = filterEls(key)
  const active = activeEls(els)
  if (active.length === 1 && active[0] === a) {
    for (const el of els) el.classList.add('active')
    withState(params => params.delete(key))
  } else {
    for (const el of els) el.classList.remove('active')
    a.classList.add('active')
    withState(params => params.set(key, a.dataset[key]))
  }
  refilter()
}
if (document.querySelector('.filtered')) refilter()

// const DUR = 3
const DUR = .2
let animating = false
let activeFig
function animate(now, done) {
  animating = true
  const start = performance.now()
  requestAnimationFrame(t => {
    now()
    setTimeout(() => {
      done()
      animating = false
    }, DUR*1000)
  })
}
function transition(prop, fn = 'ease-out') {
  return `${prop} ${DUR}s ${fn}`
}
function transform(from, to, down = false) {
  const x = to.left + to.width/2 - (from.left + from.width/2)
  const y = to.top + to.height/2 - (from.top + from.height/2)
  const sx = to.width / from.width, sy = to.height / from.height
  const s = down ? Math.max(sx, sy) : Math.min(sx, sy)
  return `translate(${x}px,${y}px) scale(${s})`
}
function noScroll(e) {
  if (e.ctrlKey) return // allow pinch zooming
  e.preventDefault()
}
function figures() {
  return Array.from(document.querySelectorAll('.fig:not(.active-fig), .ifig:not(.active-fig)'))
}
function scrollIntoViewIfNeeded(el) {
  const {clientWidth: w, clientHeight: h} = document.documentElement
  const bb = el.getBoundingClientRect()
  if (bb.left >= 0 && bb.right <= w && bb.top >= 0 && bb.bottom <= h) return
  const x = (bb.left + bb.right)/2 - w/2
  const y = (bb.top + bb.bottom)/2 - h/2
  scrollBy(x, y)
}
function showFig(openFig, animated = false, soft = false) {
  const prev = document.querySelector('.active-fig')
  if (prev) {
    hideFig(prev)
    animated = false
  }
  activeFig = openFig
  scrollIntoViewIfNeeded(openFig)
  const fig = openFig.cloneNode(true)
  const n = fig.querySelector('.caption')?.firstChild
  if (n?.nodeType === 3) {
    n.textContent = n.textContent.replace(/^\s*[a-z]/, l => l.toUpperCase())
  }
  const img = fig.querySelector('img')
  fig.classList.add('active-fig')

  if (animated) {
    const img2 = img.cloneNode()
    img2.src = img.dataset.src
    img.after(img2)

    const fbb = openFig.querySelector('img').getBoundingClientRect()
    const abb = new DOMRect(0, 0, document.documentElement.clientWidth, document.documentElement.clientHeight)
    fig.style.background = 'transparent'
    fig.style.transition = transition('background')
    img.style.transform = img2.style.transform = transform(abb, fbb, true)
    img.style.transition = img2.style.transition = transition('transform')

    animate(() => {
      img.getBoundingClientRect() // force reflow in ff
      img.style.transform = img2.style.transform = ''
      fig.style.background = ''
    }, () => {
      img.style.transition = img2.style.transition = ''
      fig.style.transition = ''
    })
  } else {
    img.src = img.dataset.src
  }
  if (!soft) {
    withState(params => params.set('fig', img.dataset.src))
  }
  document.body.append(fig)
  document.addEventListener('wheel', noScroll, {passive: false})
}
function hideFig(fig, animated = false, soft = false) {
  const img = fig.querySelector('img:last-of-type')
  img.previousElementSibling?.remove()

  if (animated) {
    const abb = img.getBoundingClientRect()
    const fbb = activeFig.querySelector('img').getBoundingClientRect()
    animate(() => {
      fig.style.background = 'transparent'
      fig.style.transition = transition('background')
      img.style.transform = transform(abb, fbb, true)
      img.style.transition = transition('transform')
    }, () => {
      fig.remove()
    })
  } else {
    fig.remove()
  }
  activeFig = null
  if (!soft) {
    withState(params => params.delete('fig'))
    document.removeEventListener('wheel', noScroll, {passive: false})
  }
}

const searchEl = document.querySelector('.top .search')
const searchField = searchEl.querySelector('input')
const searchResultsEl = document.createElement('ul')
searchResultsEl.className = 'search-results'
searchResultsEl.tabIndex = -1
searchResultsEl.hidden = true
const searchResults = []
searchField.parentElement.append(searchResultsEl)
window.SEARCH ??= []
for (const s of SEARCH) {
  s.n = normalizeSearch(s.t)
  const i = s.t.indexOf(' (')
  s.m = i === -1 ? s.n.length : i
}
function normalizeSearch(q) {
  return q.toLowerCase().replace(/[^a-zA-Z0-9\+]+/g, '')
}
function scoreResult(r, words) {
  return words.reduce((score, w, i) =>
    score + Math.max(r.n.startsWith(w) ? 20/(i + 1) : 0, r.n.includes(w) ? 10 : 0), 0) + 1/(r.m + 1)
}
function makeSearchResult() {
  const el = document.createElement('li')
  const a = document.createElement('a')
  const synopsis = document.createElement('div')
  synopsis.className = 'search-synopsis'
  a.append(document.createElement('h1'), synopsis)
  el.append(a)
  searchResultsEl.append(el)
  return el
}
function hideSearch() {
  searchResultsEl.hidden = true
}
function doSearch() {
  const q = searchField.value.trim()
  if (normalizeSearch(q) === '') {
    hideSearch()
    return
  }
  const words = q.split(/\s+/).map(normalizeSearch)
  let results = SEARCH.filter(r => r.n && words.every(w => r.n.includes(w)))
  for (const r of results) {
    r.score = scoreResult(r, words)
  }
  results.sort((a, b) => b.score - a.score)
  const top = []
  const seen = new Set
  for (const r of results) {
    if (!seen.has(r.u)) {
      seen.add(r.u)
      top.push(r)
      if (top.length >= 10) break
    }
  }
  if (top.length === 0) {
    hideSearch()
    return
  }

  let i = 0
  for (; i < top.length; ++i) {
    const r = top[i]
    const [baseU, frag] = r.u.split('#')
    const s = SEARCH.find(s => s.u == r.u && s.d) || SEARCH.find(s => s.u == baseU && s.d)
    const el = searchResults[i] ??= makeSearchResult()
    el.firstElementChild.href = r.u
    const sExact = s?.u === r.u
    el.firstElementChild.firstElementChild.innerHTML = sExact && s?.t || r.t
    el.firstElementChild.lastElementChild.innerHTML = sExact && s?.d || r.d || s?.d || ""
    el.style.opacity = r.q ? 0.5 : 1
    el.hidden = false
  }
  for (; i < searchResults.length; ++i) {
    searchResults[i].hidden = true
  }
  searchResultsEl.hidden = false
}

const rewardCalculator = document.querySelector('.reward-calculator')
const rewardSummary = document.getElementById('reward-calculator-summary')
const rewardObjective = document.getElementById('reward-calculator-objective')
const rewardMax = document.getElementById('reward-calculator-max')
const rewardExpenses = document.getElementById('reward-calculator-expenses')
const rewardBonus = document.getElementById('reward-calculator-bonus')
const rewardRespect = document.getElementById('reward-calculator-respect')
const rewardDifficulty = document.getElementById('reward-calculator-difficulty')

function commaize(n) {
  const neg = n < 0
  n = String(Math.abs(Math.round(n)))
  const off = (n.length % 3) || 3
  return (neg ? '-' : '') + n.slice(0, off) + n.slice(off).replace(/\d{3}/g, ',$&')
}
function dollarize(n) {
  return '$' + commaize(n)
}
function formatList(sep, list) {
  if (list.length <= 1) return list.join('')
  if (list.length === 2) return list.join(` ${sep} `)
  return `${list.slice(0, -1).join(', ')}, ${sep} ${list[list.length - 1]}`
}
function rangize(possible) {
  return `${commaize(Math.min(...possible))}–${commaize(Math.max(...possible))}`
}
function optionize(possible) {
  return possible.map((x, i) => i === 0 ? dollarize(x) : commaize(x)).join(' / ')
}
function round(n, digits = 0) {
  const f = 10**digits
  return Math.round(n * f)/f
}
function roundSf(n, figs) {
  const base = 10**(Math.floor(Math.log10(n)) - figs + 1)
  return Math.round(n/base)*base
}
function calculateReward(soft = false) {
  const resps = rewardRespect.value.split(' ')
  const diffs = rewardDifficulty.value.split(' ')
  const rmv = +rewardCalculator.dataset.rmv
  const omvOverride = +rewardCalculator.dataset.omv
  const mmvm = +rewardCalculator.dataset.mmvm
  const big = rewardCalculator.dataset.subtype === 'BigHeist'
  const story = rewardCalculator.dataset.subtype === 'Story'
  const intel = rewardCalculator.dataset.intel != null
  const bonus = +rewardBonus.value
  const possible = resps.flatMap(respId => {
    const resp = ECONOMY.MissionsCommonWealthConfiguration[respId]
    const steps = []
    for (let n = resp.MaxMonetaryValue.Min; n <= resp.MaxMonetaryValue.Max; n += 1000) {
      steps.push(n)
    }
    const muls = big ? resp.MultiplierOfExpensesForBigHeistInPercent : intel ? resp.MultiplierOfExpensesForMissionsWithIntelInPercent : resp.MultiplierOfExpensesForMissionsWithoutIntelInPercent
    const expenseRatios = []
    for (let n = muls.Min; n <= muls.Max; ++n) {
      expenseRatios.push(n/100)
    }
    const omv = omvOverride || resp.ObjectiveMonetaryValueInPercents
    return diffs.flatMap(diffId => {
      const diff = ECONOMY.RewardMultipliersForDifficulties[diffId]
      return steps.map(base => {
        // TODO: MissionsAdditionalWealthConfiguration.ObjectiveMonetaryValueInPercentOverride
        // TODO: MissionsAdditionalWealthConfiguration.MaxMonetaryValueMultiplier
        const maxBase = mmvm * diff * rmv * base
        const max = maxBase * (1 + bonus)
        // const obj = Math.round(max * resp.ObjectiveMonetaryValueInPercents/100/100)*100
        const obj = Math.round(max * omv/100/20)*20
        return {
          max,
          obj,
          exp: expenseRatios.map(r => roundSf(r * maxBase, 2)),
        }
      })
    })
  })
  const max = possible.map(p => p.max)
  max.sort((a, b) => a - b)
  const maxRange = `$${rangize(max)}`
  const maxAll = optionize(max)
  const obj = possible.map(p => p.obj)
  obj.sort((a, b) => a - b)
  const objRange = `$${rangize(obj)}`
  const objAll = optionize(obj)
  const exp = Array.from(new Set(possible.flatMap(p => p.exp)))
  exp.sort((a, b) => a - b)
  const expRange = `$${rangize(exp)}`
  const expAll = optionize(exp)

  const THRESH = 3
  rewardSummary.textContent = objRange
  rewardMax.textContent = max.length <= THRESH ? maxAll : maxRange
  rewardMax.title = maxAll
  rewardObjective.textContent = max.length <= THRESH ? objAll : objRange
  rewardObjective.title = objAll
  rewardExpenses.textContent = exp.length <= THRESH ? expAll : expRange
  rewardExpenses.title = expAll

  if (!soft) {
    withState(params => {
      if (resps.length > 1) {
        params.delete('reward-respect')
      } else {
        params.set('reward-respect', rewardRespect.value)
      }
      if (diffs.length > 1) {
        params.delete('reward-difficulty')
      } else {
        params.set('reward-difficulty', rewardDifficulty.value)
      }
      if (+rewardBonus.value === 0) {
        params.delete('reward-bonus')
      } else {
        params.set('reward-bonus', rewardBonus.value)
      }
    })
  }
}

const loadParams = () => {
  const params = new URLSearchParams(location.hash.slice(1))
  if (params.range) {
    targetRangeEl.value = params.range
  }
  if (params.get('suppressed')) {
    setFilterState('suppressed', params.get('suppressed').split(','))
  }
  if (params.get('firemodes')) {
    setFilterState('firemodes', params.get('firemodes').split(','))
  }
  if (params.get('quality')) {
    setFilterState('quality', params.get('quality').split(','))
  }
  if (params.get('unique')) {
    setFilterState('unique', params.get('unique').split(','))
  }
  if (params.get('class')) {
    setFilterState('class', params.get('class').split(','))
  }
  if (params.get('type')) {
    setFilterState('type', params.get('type').split(','))
  }
  if (params.get('range') && targetRangeEl) {
    targetRangeEl.value = params.get('range')
  }
  if (params.get('sort')) {
    sortBy(document.querySelector(`[data-id="${params.get('sort')}"]`), params.get('descending') != null, true)
  }
  refilter()
  if (params.get('fig')) {
    const img = document.querySelector(`img[data-src="${params.get('fig')}"]`)
    const fig = img && img.closest('.fig, .ifig')
    if (img) {
      showFig(fig, false, true)
    }
  }
  if (params.get('reward-respect')) {
    rewardRespect.value = params.get('reward-respect')
  }
  if (params.get('reward-difficulty')) {
    rewardDifficulty.value = params.get('reward-difficulty')
  }
  if (params.get('reward-bonus')) {
    rewardBonus.value = params.get('reward-bonus')
  }
  if (rewardCalculator) calculateReward(true)
}
addEventListener('hashchange', loadParams)
loadParams()

const targetRangeChanged = () => {
  withState(params => params.set('range', targetRangeEl.value))
  refilter()
  resort()
}
const updateTargetRange = e => {
  e.preventDefault()
  const bb = targetRangeEl.getBoundingClientRect()
  targetRangeEl.value = lerp(targetRangeEl.min, targetRangeEl.max, Math.max(0, Math.min(1, (e.clientX - bb.left) / bb.width)))
  targetRangeEl.focus({preventScroll: true})
  targetRangeChanged()
}

const spoilEl = document.getElementById('spoil-everything')
const respoil = () => {
  const isSpoiled = localStorage.spoiled === 'true'
  document.body.classList.toggle('spoiled', isSpoiled)
  if (spoilEl) spoilEl.checked = isSpoiled
}
respoil()

let drag = {}
document.addEventListener('pointerdown', e => {
  if (e.target.closest('.filters .range')) {
    drag[e.pointerId] = 'range'
    updateTargetRange(e)
  }
})
document.addEventListener('pointermove', e => {
  if (drag[e.pointerId] === 'range') {
    updateTargetRange(e)
  }
})
document.addEventListener('pointerup', e => {
  delete drag[e.pointerId]
})
document.addEventListener('click', e => {
  const th = e.target.closest('th.sort')
  if (th) {
    sortBy(th)
    e.preventDefault()
    return
  }
  const filter = e.target.closest('.filters a')
  if (filter && !filter.href) {
    filterBy(filter)
    e.preventDefault()
    return
  }
  const spoilers = e.target.closest('.spoilers, .reserved')
  if (spoilers && !spoilers.closest('.spoiled')) {
    spoilers.classList.add('spoiled')
    e.preventDefault()
    return
  }
  const task = e.target.closest('.task-disclosing')
  if (task) {
    const disclosed = task.nextElementSibling
    task.classList.toggle('open')
    disclosed.hidden = !disclosed.hidden
    e.preventDefault()
    return
  }
  const result = e.target.closest('.search-results a')
  if (result) {
    hideSearch()
  }
  if (e.target.closest('a[data-search]')) {
    searchField.select()
    e.preventDefault()
    return
  }
  if (animating) return

  const closeFig = e.target.closest('.active-fig img')
  if (closeFig) {
    const fig = closeFig.closest('.active-fig')
    hideFig(fig, true)
    e.preventDefault()
    return
  }
  const openFig = e.target.closest('.fig:not(.active-fig), .ifig:not(.active-fig)')
  if (openFig && !e.target.closest('a[href]') && getSelection().isCollapsed) {
    showFig(openFig, true)
    e.preventDefault()
    return
  }
})
document.addEventListener('keydown', e => {
  if (animating) return
  if (activeFig) {
    const figs = figures()
    const i = figs.indexOf(activeFig)
    switch (e.key) {
    case 'ArrowLeft':
      if (i !== -1) showFig(figs[i === 0 ? figs.length - 1 : i - 1])
      break
    case 'ArrowRight':
      if (i !== -1) showFig(figs[(i + 1) % figs.length])
      break
    case 'Escape':
      hideFig(document.querySelector('.active-fig'), true)
      break
    default: return
    }
    e.preventDefault()
    return
  }
  if (e.target === searchField) {
    switch (e.key) {
    case 'Enter':
      const r = searchResults[0]
      if (r && !r.hidden && !searchResultsEl.hidden) {
        r.firstElementChild.click()
        searchField.blur()
      }
      break
    case 'Escape':
      searchField.value = ''
      searchField.blur()
      break
    default: return
    }
    e.preventDefault()
    return
  }
  if (e.target.matches('.fig, .ifig')) {
    switch (e.key) {
    case 'Enter':
      e.preventDefault()
      showFig(e.target, true)
      break
    }
  }
  if (e.target === document.body || e.target.matches('a, .fig, .ifig')) {
    switch (e.key) {
    case '/':
    case 's':
      if (e.metaKey || e.shiftKey || e.ctrlKey) return
      scrollIntoViewIfNeeded(searchField)
      searchField.select()
      break
    case 'B':
    case 'b': {
      if (!e.metaKey || !e.shiftKey || !e.ctrlKey) return
      const backdrop = document.querySelector('.backdrop')
      backdrop.setAttribute('src', backdrop.getAttribute('src').replace(/(\d+|[a-z])(?=\.)/, n => +n === +n ? +n + 1 : String.fromCharCode(n.charCodeAt(0) + 1)))
      break
    }
    default: return
    }
    e.preventDefault()
    return
  }
})
document.addEventListener('input', e => {
  if (e.target.closest('.reward-calculator')) {
    calculateReward()
  }
  if (spoilEl && e.target === spoilEl) {
    localStorage.spoiled = spoilEl.checked
    respoil()
  }
  const rangeEl = e.target.closest('.filters .range input')
  if (rangeEl) {
    targetRangeChanged()
  }
  const selectEl = e.target.closest('select.filters')
  if (selectEl) {
    const key = selectEl.dataset.id
    if (selectEl.value) {
      withState(params => params.set(key, selectEl.value))
    } else {
      withState(params => params.delete(key))
    }
    refilter()
  }
  if (e.target === searchField) {
    doSearch()
  }
})
document.addEventListener('focusin', e => {
  if (e.target === searchField) {
    doSearch()
  }
})
document.addEventListener('focusout', e => {
  if (e.target.closest('.search')) {
    if (e.relatedTarget?.closest('.search')) return
    hideSearch()
  }
})
