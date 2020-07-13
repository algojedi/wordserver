// const jwt = require('jsonwebtoken')
const redisClient = require('../redis')

module.exports = async (req, res, next) => {
    // save userid on req object if there's a token
    const { authorization } = req.headers // authorization is the token
    if (!authorization) {
        const error = new Error('Not authenticated')
        error.statusCode = 401
        throw error
    }
    console.log({ authorization })
    await redisClient.get(authorization, (err, reply) => {
        if (err || !reply) {
            console.log('issue with token', err)
            return res.status(400).json({ error: { message: 'Authorization denied' } })
        }
        console.log('reply from redis in middleware', reply)
        req.userId = JSON.parse(reply)
        next()
    })
}
