const { validationResult } = require('express-validator')

module.exports = async (req, res, next) => {
    const errors = validationResult(req)
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
