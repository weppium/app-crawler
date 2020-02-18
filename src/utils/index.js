import { escapeHtml, generateStatus, offsetParents } from './el'
import { isEmpty, isExist } from './is'

export { escapeHtml, generateStatus, offsetParents, isEmpty, isExist }

export const hasOwnProperty = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key)

/**
 * Deep clone
 * @param  {Object|Array}
 * @return {Object|Array}
 */
export function deepClone (obj) {
  if (typeof obj !== 'object' || obj === null) {
    return obj
  }

  const array = []
  if (obj.constructor === Array) {
    for (let i = 0; i < obj.length; i++) {
      array.push(deepClone(obj[i]))
    }
    return array
  }

  const struct = {}
  for (const p in obj) {
    if (hasOwnProperty(obj, p)) {
      struct[p] = obj[p] && typeof obj[p] === 'object' ? deepClone(obj[p]) : obj[p]
    }
  }

  return struct
}

/**
 * Camel case to dash
 * @param  {String} str
 * @return {String}
 */
export function camelToDash (str) {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
}

/**
 * Camelize a string, cutting the string by separator character.
 * @param string Text to camelize
 * @param string Word separator (dash by default)
 * @return string Camelized text
 */
export function camelize (text, separator = '-') {
  // Cut the string into words
  const words = text.split(separator)

  // Concatenate all capitalized words to get camelized string
  let result = ''
  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    const capitalizedWord = word.charAt(0).toUpperCase() + word.slice(1)
    result += capitalizedWord
  }

  return result
}

/**
 * Capitalize a string, cutting the string by separator character.
 * @param string Text to capitalize
 * @return string Capitalized text
 */
export function capitalize (text, separator) {
  const word = camelize(text, separator)
  return word.charAt(0).toUpperCase() + word.slice(1)
}

/**
 * Not supported
 * iOS, external adb, reporting, device server
 * @returns {boolean}
 */
export function notSupported () {
  // return true;
  return false
}

/**
 * specifying the Unicode Normalization (Default NFC)
 * @param string Text
 * @returns {string}
 */
export function normalizeByNFC (str) {
  return str ? str.normalize() : ''
}
