const { validationResult } = require('express-validator')

// attach user id to request object, using incoming token
module.exports = async (req, res, next) => {
    // username must be an email
    // console.log('validating..')
    // body('email').isEmail()
    // // password must be at least 5 chars long
    // body('password').isLength({ min: 4 })
    // Finds the validation errors in this request and wraps them in an object with handy functions
    const errors = validationResult(req)
    console.log({errors})
    if (!errors.isEmpty()) {
        console.log('invalid creds')
        return res
            .status(400)
            .json({
                error: {
                    message: errors.array(),
                    detail: 'invalid email or password'
                }
            })
    }
    next()
}
