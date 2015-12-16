<!-- target: var -->
/**
 * 
 *
<!-- if: ${isClass} -->
 * @class
<!-- else -->
<!-- if: ${isConst} -->
 * @const
<!-- /if -->
 * @type {${type}}
<!-- /if -->
 */

<!-- target: fn -->
/**
 * 
 *
<!-- if: ${isClass} -->
 * @class
<!-- /if -->
<!-- for: ${params} as ${param} -->
 * @param {} ${param}
<!-- /for -->
<!-- if: ${hasReturn} -->
 * @return {}
<!-- /if -->
 */

<!-- target: cls -->
/**
 * 
 *
 * @class
 <!-- if: ${superClass} -->
 * @extends ${superClass}
 <!-- /if -->
 */

<!-- target: method -->
/**
 * 
 *
 * @public
<!-- if: ${isConstructor} -->
 * @constructor
<!-- /if -->
<!-- for: ${params} as ${param} -->
 * @param {} ${param}
<!-- /for -->
<!-- if: ${hasReturn} -->
 * @return {}
<!-- /if -->
 */
