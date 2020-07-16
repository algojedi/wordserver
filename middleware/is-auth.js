const redisClient = require('../redis')

// attach user id to request object, using incoming token
module.exports = async (req, res, next) => {
    console.log('checking auth token')
    // save userid on req object if there's a token
    const { authorization } = req.headers // authorization is the token
    console.log({ authorization })
    if (!authorization) {
        const error = new Error('Not authenticated')
        error.statusCode = 401
        throw error
    }
    console.log({ authorization })
    await redisClient.get(authorization, (err, reply) => {
        if (err || !reply) {
            console.log('issue with token', err)
            return res
                .status(400)
                .json({ error: { message: 'Authorization denied' } })
        }
        console.log('reply from redis in middleware', reply)
        req.userId = JSON.parse(reply)
        next()
    })
}
