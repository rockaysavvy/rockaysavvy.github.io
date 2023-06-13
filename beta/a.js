const toNumberMaybe = x => +x === +x ? +x : x
const toValue = el => toNumberMaybe(el.dataset.v || el.textContent)

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
    return sign * ((typeof a == 'number') - (typeof b === 'number') || (typeof a === 'number' ? a - b : a.localeCompare(b)))
  })
  tbody.append(...rows)
  if (!soft) {
    const params = new URLSearchParams(location.hash.slice(1))
    params.set('sort', th.dataset.id)
    if (sign === -1) {
      params.set('descending', '')
    } else {
      params.delete('descending')
    }
    history.replaceState(null, '', '#' + params)
  }
}
const filterEls = key =>
  Array.from(document.querySelectorAll(`.filters a[data-${key}]`))

const activeEls = els =>
  els.filter(el => el.classList.contains('active'))

const filterState = key =>
  activeEls(filterEls(key)).map(el => el.dataset[key])

const refilter = () => {
  const qualities = filterState('quality')
  const firemodes = filterState('firemode').join('').split('')
  const types = filterState('type')
  const suppresseds = filterState('suppressed')
  const allFiremodes = firemodes.length === 4

  const filtered = document.querySelector('.filtered')
  for (const el of filtered.children) {
    const show = qualities.includes(el.dataset.quality) && types.includes(el.dataset.type) && suppresseds.includes(el.dataset.suppressed) && (allFiremodes || firemodes.some(f => el.dataset.firemodes.includes(f)))
    el.style.display = show ? '' : 'none'
  }
}
const filterBy = (a, on) => {
  const key = Object.keys(a.dataset)[0]
  const els = filterEls(key)
  const active = activeEls(els)
  if (active.length === 1 && active[0] === a) {
    for (const el of els) el.classList.add('active')
  } else {
    for (const el of els) el.classList.remove('active')
    a.classList.add('active')
  }
  refilter()
}

// const DUR = 3
const DUR = .2
let animating = false
let activeFig
function animate(now, done) {
  animating = true
  requestAnimationFrame(() => {
    now()
  })
  setTimeout(() => {
    done()
    animating = false
  }, DUR*1000)
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
function showFig(openFig, animated = false, soft = false) {
  const prev = document.querySelector('.active-fig')
  if (prev) {
    hideFig(prev)
    animated = false
  }
  activeFig = openFig
  openFig.scrollIntoViewIfNeeded(true)
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
    const params = new URLSearchParams(location.hash.slice(1))
    params.set('fig', img.dataset.src)
    history.replaceState(null, '', '#' + params)
    document.body.append(fig)
    document.addEventListener('wheel', noScroll, {passive: false})
  }
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
    const params = new URLSearchParams(location.hash.slice(1))
    params.delete('fig')
    history.replaceState(null, '', '#' + params)
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
for (const s of SEARCH) {
  s.n = normalizeSearch(s.t)
}
function normalizeSearch(q) {
  return q.toLowerCase().replace(/[^a-zA-Z0-9]+/g, '')
}
function scoreResult(r, words) {
  return words.reduce((score, w, i) =>
    score + Math.max(r.n.startsWith(w) ? 20/(i + 1) : 0, r.n.includes(w) ? 10 : 0), 0) + 1/(r.n.length + 1)
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
  results = results.slice(0,10)
  if (results.length === 0) {
    hideSearch()
    return
  }

  let i = 0
  for (; i < results.length; ++i) {
    const r = results[i]
    const el = searchResults[i] ??= makeSearchResult()
    el.firstElementChild.href = r.u
    el.firstElementChild.firstElementChild.innerHTML = r.t
    el.firstElementChild.lastElementChild.innerHTML = r.d
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
    const params = new URLSearchParams(location.hash.slice(1))
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
    history.replaceState(null, '', '#' + params)
  }
}

const params = new URLSearchParams(location.hash.slice(1))
if (params.get('sort')) {
  sortBy(document.querySelector(`[data-id="${params.get('sort')}"]`), params.get('descending') != null, true)
}
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
  if (animating) return

  const closeFig = e.target.closest('.active-fig img')
  if (closeFig) {
    const fig = closeFig.closest('.active-fig')
    hideFig(fig, true)
    e.preventDefault()
    return
  }
  const openFig = e.target.closest('.fig:not(.active-fig), .ifig:not(.active-fig)')
  if (openFig && !e.target.closest('a[href]')) {
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
      }
      break
    default: return
    }
    e.preventDefault()
    return
  }
  if (e.target === document.body || e.target.matches('a')) {
    switch (e.key) {
    case '/':
    case 's':
      searchField.scrollIntoViewIfNeeded()
      searchField.select()
      break
    case 'B':
    case 'b': {
      if (!e.metaKey || !e.shiftKey || !e.ctrlKey) return
      const backdrop = document.querySelector('.backdrop')
      backdrop.setAttribute('src', backdrop.getAttribute('src').replace(/\d+/, n => +n + 1))
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
