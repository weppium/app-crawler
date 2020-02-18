/**
 * Is it empty?
 * @param  {*}       v - variable
 * @return {boolean}
 */
/* eslint-disable */
export function isEmpty(v) {
  return (
    v === null ||
    v === undefined ||
    (v.hasOwnProperty('length') && v.length === 0) ||
    (v.constructor === Object && Object.keys(v).length === 0)
  );
}
/* eslint-enable */

/**
 * Is it exist?
 * @param  {*}       v - variable
 * @return {boolean}
 */
export function isExist (v) {
  return !isEmpty(v)
}

/*
const scrollSize = 12
function hasScroll ($el, axis) {
  const overflow = $el.css('overflow')
  let overflowAxis

  if (typeof axis === 'undefined' || axis === 'y') {
    overflowAxis = $el.css('overflow-y')
  } else {
    overflowAxis = $el.css('overflow-x')
  }

  const bShouldScroll = $el.get(0).scrollHeight > $el.innerHeight()
  const bAllowedScroll = (overflow === 'auto' || overflow === 'visible') ||
    (overflowAxis === 'auto' || overflowAxis === 'visible')
  const bOverrideScroll = overflow === 'scroll' || overflowAxis === 'scroll'
  return (bShouldScroll && bAllowedScroll) || bOverrideScroll
}

function isInRect (rect, x, y) {
  return (y >= rect.top && y <= rect.bottom) && (x >= rect.left && x <= rect.right)
}

export function isInScrollRange (event) {
  const x = event.pageX
  const y = event.pageY
  const $el = $(event.target)
  const hasY = hasScroll($el)
  const hasX = hasScroll($el, 'x')
  let bInX = false
  let bInY = false

  if (hasY) {
    const rY = { top: $el.offset().top, right: $el.offset().left + $el.width() }
    rY.bottom = rY.top + $el.height()
    rY.left = rY.right - scrollSize

    // if (hasX) rY.bottom -= scrollSize;
    bInY = isInRect(rY, x, y)
  }

  if (hasX) {
    const rX = { bottom: $el.offset().top + $el.height(), left: $el.offset().left }
    rX.top = rX.bottom - scrollSize
    rX.right = rX.left + $el.width()

    // if (hasY) rX.right -= scrollSize;
    bInX = isInRect(rX, x, y)
  }

  return bInX || bInY
}
*/
