'use strict'

class MinMax {
  constructor(xs, all = false) {
    this.min = Infinity
    this.max = -Infinity
    this.all = all ? [] : null
    if (xs) {
      for (const x of xs) {
        this.update(x)
      }
    }
  }
  update(x) {
    if (x < this.min) this.min = x
    if (x > this.max) this.max = x
    if (this.all) this.all.push(x)
  }
}
const toNumberMaybe = x => +x === +x ? +x : x
const toValue = el => toNumberMaybe(el.dataset.v || el.textContent)
const lerp = (a, b, t) => (1 - t) * a + t * b

const colsDescend = Array.from(document.querySelector('.filtered-table tr.secondary')?.children || [], th => th.classList.contains('descending'))
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
const formEl = key =>
  document.querySelector(`:is(select, input)[data-id=${key}]`)

const activeEls = els =>
  els.filter(el => el.classList.contains('active'))

const paramState = key => filterState(key)
const filterState = key => {
  const form = formEl(key)
  if (!form) return activeEls(filterEls(key)).map(el => el.dataset[key])
  if (form.tagName === 'input' && form.type === 'checkbox') return form.checked
  if (form.value) return [form.value]
  if (form.options) return Array.from(form.options, x => x.value).filter(x => x)
  return []
}
const setFilterState = (key, values) => {
  const el = formEl(key)
  if (el) {
    if (el.type === 'checkbox') {
      el.checked = values[0] === 'true'
    } else {
      el.value = values[0] || ''
    }
    return
  }
  for (const el of filterEls(key)) {
    el.classList.toggle('active', values.length === 0 || el.dataset[key].split(',').every(v => values.includes(v)))
  }
}

function setFixed(prec, el, f) {
  if (!el) return
  el.dataset.v = f
  el.textContent = f.toFixed(prec)
}
const FILTERED = {
  wdefs() {
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
    return el => {
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

        setFixed(0, el.querySelector('.damage'), damage)
        setFixed(0, el.querySelector('.damage-enemy'), damageAiEnemy)
        setFixed(0, el.querySelector('.damage-heister'), damageAiHeister)
        setFixed(0, el.querySelector('.dps-heister'), dpsAiHeister)
        setFixed(0, el.querySelector('.dps-enemy'), dpsAiEnemy)
        setFixed(0, el.querySelector('.dps-inst-heister'), dpsInstAiHeister)
        setFixed(0, el.querySelector('.dps-inst-enemy'), dpsInstAiEnemy)
        const dimEl = el.querySelector('.dim')
        if (dimEl) {
          dimEl.dataset.v = isMelee || ammoCost === 0 ? 0 : dim
          dimEl.textContent = isMelee || ammoCost === 0 ? '' : dim.toFixed(0)
        }
        setFixed(0, el.querySelector('.dps-inst'), dpsInst)
        setFixed(0, el.querySelector('.dps'), dps)
      }
      return qualities.includes(el.dataset.quality)
        && types.includes(el.dataset.type)
        && suppresseds.includes(el.dataset.suppressed)
        && uniques.includes(el.dataset.unique)
        && (allFiremodes || firemodes.some(f => el.dataset.firemodes.includes(f)))
        && classes.includes(el.dataset.class)
    }
  },
  chars() {
    const qualities = filterState('quality')
    const levels = filterState('level')
    return el =>
      qualities.includes(el.dataset.quality)
      && levels.includes(el.dataset.level)
  },
  missions() {
    const userDiffs = paramState('user-diff')
    const respects = paramState('respect')
    const scenDiffs = paramState('scen-diff')
    // const soldiersFrac = document.querySelector('[data-id=intel-soldiers]').value / 100
    const gatherIntel = document.querySelector('[data-id=intel]').checked
    // const cardBonuses = paramState('card-bonus')
    const cardBonus = +document.querySelector('[data-id=card-bonus]').value
    const stars = paramState('stars')
    const bossPresent = document.querySelector('[data-id=boss-present]').checked
    // const quickjoin = document.querySelector('[data-id=quickjoin]').checked
    const lobby = document.querySelector('[data-id=lobby]').value
    const humanPlayers = document.querySelector('[data-id=human-players]').checked
    const lootPct = document.querySelector('[data-id=extra-loot-pct]').value
    const totalMissionCutPctMeta = document.querySelector('[data-id=total-mission-cut-pct]').value
    const totalMissionCutPctQuickplay = 4 * +document.querySelector('[data-id=bots]').value

    const dbs = filterState('db')
    const subtypes = filterState('subtype')
    return el => {
      if (!(
        dbs.includes(el.dataset.db)
        && subtypes.includes(el.dataset.subtype)
      )) return false

      const id = el.dataset.id
      const scenario = el.dataset.scenario
      const db = el.dataset.db
      const subtype = el.dataset.subtype
      const intelSoldierMul = el.dataset.intelsoldiermul
      const scenDiff = el.dataset.scendiff
      const lootFix = el.dataset.lootfix

      const totalMissionCutPct = db === 'meta' ? totalMissionCutPctMeta : totalMissionCutPctQuickplay
      const r = rewardsRange({id, scenario, db, subtype, intelSoldierMul, scenDiff, lootFix}, {respects, scenDiffs, userDiffs, cardBonus, bossPresent, lobby, stars, gatherIntel, totalMissionCutPct, lootPct})
      setFixed(0, el.querySelector('.net-min'), r.net.min)
      setFixed(0, el.querySelector('.net-max'), r.net.max)
      setFixed(0, el.querySelector('.max-min'), r.max.min)
      setFixed(0, el.querySelector('.max-max'), r.max.max)
      setFixed(0, el.querySelector('.obj-min'), r.obj.min)
      setFixed(0, el.querySelector('.obj-max'), r.obj.max)
      setFixed(0, el.querySelector('.exp-min'), r.exp.min)
      setFixed(0, el.querySelector('.exp-max'), r.exp.max)

      const x = xpRange({id, scenario, subtype}, {userDiffs, humanPlayers, stars})
      setFixed(0, el.querySelector('.xp-min'), x.min)
      setFixed(0, el.querySelector('.xp-max'), x.max)
      return true
    }
  },
}

const targetRangeEl = document.querySelector('.filters .range input')
const refilter = () => {
  const filtered = document.querySelector('.filtered')
  if (!filtered) return

  const isTable = filtered.localName === 'tbody'
  const filter = FILTERED[filtered.dataset.kind]()
  const minmax = Array.from(colsDescend, desc => {
    return {minOut: NaN, min: NaN, avg: 0, max: NaN, maxOut: NaN, desc}
  })
  const advanced = document.querySelector('[data-id=show-advanced]')
  if (advanced && isTable) {
    const show = advanced.checked
    for (const el of filtered.parentNode.querySelectorAll('.advanced')) {
      el.hidden = !show
    }
  }

  let count = 0
  for (const el of filtered.children) {
    const show = filter(el)
    el.style.display = show ? '' : 'none'
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
    if (mm.min !== mm.min) mm.min = mm.minOut
  }
  for (const el of filtered.children) {
    if (el.style.display !== 'none') {
      let j = 0
      for (const td of el.children) {
        const mm = minmax[j++]
        if (mm.minOut === mm.maxOut) {
          td.style.color = ''
          continue
        }
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
  ;[s.ub, s.uf] = s.u.split('#')
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
    if (!seen.has(r.ub)) {
      seen.add(r.ub)
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
    const s = SEARCH.find(s => s.u == r.u && s.d) || SEARCH.find(s => s.u == r.ub && s.d)
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
  if (n < 0.1) return 0
  const base = 10**(Math.floor(Math.log10(n)) - figs + 1)
  return Math.round(n/base)*base
}
function tagMatches(query, tag) {
  return query === tag || tag.startsWith(query) && tag.charAt(query.length) === '.'
}
function findAdditional(scenario, econ) {
  scenario = 'Mission.' + scenario
  for (const rap of econ.MoneyMakingScenariosAdditionalWealthAndProbabilitiesConfiguration) {
    if (rap.MoneyMakingScenarios.some(s => tagMatches(s, scenario))) return rap
  }
}
function findHeistTypeRewardMul(scenario, prog) {
  scenario = 'Mission.' + scenario
  for (const rm of prog.HeistTypeRewardMultipliers) {
    if (rm.MissionScenarios.some(s => tagMatches(s, scenario))) return rm
  }
}
function findLootBagConfig(scenario, econ) {
  scenario = 'Mission.' + scenario
  for (const lbc of prog.LootBagConfigurations) {
    if (lbc.Missions.some(s => tagMatches(s, scenario))) return lbc
  }
}
function starMul(stars, econ) {
  return stars === '3' ? 0 :
    stars === '2' ? econ.NassaraExpensesFor2stStar/100 :
    stars === '1' ? econ.NassaraExpensesFor1stStar/100 : 0
}
function xpRange({id, subtype, scenario, db}, {stars, userDiffs, humanPlayers}, all = false) {
  const isMeta = db === 'meta'
  const prog = DATA.progression
  const supportsStars = subtype === 'MoneyMaking' || subtype === 'Story' || subtype === 'BigHeist'
  const starPtsOpts = supportsStars ?
    new MinMax(Array.from(stars, s => prog.MissionRatingBonus[s]), all) :
    new MinMax([prog.MissionNotSupportingStars], all)
  const humanPts = !isMeta && humanPlayers ? prog.WithHumanPlayers : 0
  const udMuls = new MinMax(Array.from(userDiffs, ud => prog.UserDifficultyMultiplier[ud]), all)
  const rm = findHeistTypeRewardMul(scenario, prog)
  // console.log(scenario, rm)
  const scenarioMul = rm ? rm.RewardMultiplier : 1
  // TODO: is GameplayTimeReward actually used? testing says no
  const total = new MinMax(null, true)
  for (const small of all ? [false] : [false, true]) {
    for (const starPts of starPtsOpts.all || [small ? starPtsOpts.min : starPtsOpts.max]) {
      for (const udMul of udMuls.all || [small ? udMuls.min : udMuls.max]) {
        // console.log({starPts, humanPts, scenarioMul, udMul})
        total.update(Math.floor((starPts + humanPts) * scenarioMul * udMul))
      }
    }
  }
  return total
}
function* iterRange(range, by = 1) {
  for (let i = range.Min; i <= range.Max; i += by) {
    yield i
  }
}
function rewardsRange({id, scenario, db, subtype, intelSoldierMul, scenDiff, lootFix}, {respects, scenDiffs, userDiffs, cardBonus, bossPresent, lobby, stars, gatherIntel, totalMissionCutPct, lootPct}, all = false) {
  const maxMoney = new MinMax(null, all)
  const objMoney = new MinMax(null, all)
  const expenses = new MinMax(null, all)
  const netMoney = new MinMax(null, all)

  const isMeta = db === 'meta'
  const isBig = subtype === 'BigHeist'
  const hasIntel = !!intelSoldierMul
  const econ = isMeta ? DATA.econCampaign : DATA.econQuickplay
  const common = isMeta ? DATA.campaign : DATA.quickplay
  const mamv = econ.MissionsAdditionalWealthConfiguration[id]
  const additional = findAdditional(scenario, econ)
  const sd = new MinMax(scenDiffs.map(d => econ.RewardMultipliersForDifficulties[d]), all)
  const starsMul = new MinMax(stars.map(s => starMul(s, econ)), all)
  const mvMul = mamv?.MaxMonetaryValueMultiplier || 1;
  // TODO: not sure these should be combined
  const bossBonus = isMeta && bossPresent ? econ.BossCharacterConfiguration.MissionBonusReward/100 : 0
  const spBonus = bossBonus
  const maxBonus = isMeta ? 1 + cardBonus : 1

  if (!isMeta) respects = ['Low']

  for (const userDiff of userDiffs) {
    const sdForce = scenDiff || isBig && common.CampaignDifficulty?.[userDiff]?.BigHeistDifficultyOverride
    const sdForceMul = sdForce && econ.RewardMultipliersForDifficulties[sdForce]
    const sdMulMin = sdForceMul || sd.min
    const sdMulMax = sdForceMul || sd.max

    const mpBonus = isMeta ? 0 : common.DifficultyBonusPercentage[userDiff] + (lobby === 'Quickjoin' ? common.QuickjoinBonusPercentage : common.LobbyTypeBonusPercentage[lobby])
    const postBonus = 1 + mpBonus + spBonus

    for (const respId of respects) {
      const mmv = econ.MissionsCommonWealthConfiguration[respId]
      const omvMul = (mamv?.ObjectiveMonetaryValueInPercentOverride || mmv.ObjectiveMonetaryValueInPercents)/100

      const expPcts =
        isBig ? mmv.MultiplierOfExpensesForBigHeistInPercent :
        hasIntel ? mmv.MultiplierOfExpensesForMissionsWithIntelInPercent :
        mmv.MultiplierOfExpensesForMissionsWithoutIntelInPercent
      const base = mmv.MaxMonetaryValue

      const rap = additional?.RewardsAndProbabilities[respId]
      const rmv = rap?.RelativeMonetaryValue || 1;

      for (const small of all ? [false] : [false, true]) {
        for (const baseThis of all ? iterRange(base, 1000) : [small ? base.Min : base.Max]) {
          for (const sdMulThis of sdForce ? [sdForceMul] : sd.all || [small ? sdMulMin : sdMulMax]) {
            // TODO: players?!
            // TODO: intel
            // TODO: mamv RewardMultiplierFor1stStar (currently unused)

            let max = round(sdMulThis * mvMul * rmv * baseThis, -3)
            let obj = roundSf(max * omvMul, 2)
            const planningCostMin = round(max * expPcts.Min/100, -2)
            const planningCostMax = round(max * expPcts.Max/100, -2)
            max *= maxBonus
            if (isMeta && intelSoldierMul && gatherIntel) {
              max = max * mmv.MultiplierOfMaxMonetaryValueForMissionWithIntel
              obj = roundSf(max * omvMul, 2)
            }
            obj *= postBonus
            max *= postBonus
            if (lootFix === 'zero') max = obj
            // if (lootFix === 'double') max = max

            // const monMulFix = lootFix === 'double' ? 2 : 1
            maxMoney.update(max/* * monMulFix*/)
            objMoney.update(obj/* * monMulFix*/)

            let missionCuts = totalMissionCutPct/100 * obj
            // this is fucking retarded
            if (isMeta) missionCuts = roundSf(missionCuts, 2)

            for (const planningCost of all ? iterRange({
              Min: planningCostMin,
              Max: planningCostMax,
            }, 100) : [planningCostMin, planningCostMax]) {
              for (const starsMulThis of starsMul.all || [small ? starsMul.min : starsMul.max]) {
                const mon = obj + (max - obj) * lootPct/100
                const fencingCosts = starsMulThis * obj
                const expTotal = fencingCosts + planningCost + missionCuts
                expenses.update(expTotal)
                netMoney.update(mon/* * monMulFix*/ - expTotal)
                // if (id === 'Quick_mm_Jewelry_Default_Beach_1')
                // if (id === 'Quick_cag_CagnalisOrder-Fortress')
                // if (id === 'mm_GangsterRobbery-Harbor_Drugs')
                // if (id === 'mm_Jewelry-Show_Jewelry')
                // if (id === 'ATG_ArtOfHeisting')
                // if (id === 'Quick_mm_Jewelry_Default_Beach_1')
                // if (id === 'Quick_mm_HiddenVault1' || id === 'Quick_mm_HiddenVault2')
                //   console.log({
                //     econ, common, mamv, additional, mmv, rap,
                //     sdForce, sdMulThis, starsMulThis, baseThis, planningCostMin, planningCostMax,
                //     mvMul, bossBonus, spBonus, mpBonus, postBonus, maxBonus, rmv, omvMul,
                //     max, obj, mon, fencingCosts, planningCost, missionCuts, expTotal,
                //   })
              }
            }
          }
        }
      }
    }
  }
  return {
    max: maxMoney,
    obj: objMoney,
    exp: expenses,
    net: netMoney,
  }
}
function lootBagRange({id, lootBagsBase}) {
  const lbc = findLootBagConfig(scenario, db)
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
  for (const key of [
    // missions
    'subtype', 'db',
    'user-diff', 'stars', 'extra-loot-pct',
    'respect', 'intel', 'card-bonus', 'total-mission-cut-pct', 'boss-present',
    'lobby', 'bots', 'players', 'human-players',
    'scen-diff', 'show-advanced',
    // wdefs
    'suppressed', 'firemodes', 'quality', 'unique', 'class', 'type',
  ]) {
    if (params.get(key)) {
      setFilterState(key, params.get(key).split(','))
    }
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
  const formEl = e.target.closest(':is(.view, .params) :is(select, input)')
  if (formEl) {
    const key = formEl.dataset.id
    if (formEl.type === 'checkbox') {
      withState(params => params.set(key, formEl.checked))
    } else if (formEl.value) {
      withState(params => params.set(key, formEl.value))
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
