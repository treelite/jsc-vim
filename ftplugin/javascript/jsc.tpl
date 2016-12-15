<!-- target: let -->
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
<!-- if: ${isPublic} -->
 * @public
<!-- /if -->
<!-- if: ${isPrivate} -->
 * @private
<!-- /if -->
<!-- if: ${isConstructor} -->
 * @constructor
<!-- /if -->
<!-- for: ${params} as ${param} -->
 * @param {} ${param}
<!-- /for -->
<!-- if: ${returnType} -->
 * @return {${returnType}}
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

<!-- target: file -->
/**
 * @file
 * @author ${name}(${email})
 */
