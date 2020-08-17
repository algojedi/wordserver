/* eslint-disable import/no-extraneous-dependencies */
const express = require('express')
const bodyParser = require('body-parser')
const path = require('path')
const compression = require('compression')
const cors = require('cors')
const mongoose = require('mongoose')
const rateLimit = require('express-rate-limit')
const morgan = require('morgan')
const wordRoutes = require('./routes/words')
const userRoutes = require('./routes/user')
require('dotenv').config()

const app = express()

if (process.env.NODE_ENV === 'production') {
    console.log('Running in production')
    app.use(express.static(path.join(__dirname, 'client', 'wordsie', 'build')))
    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, 'client', 'wordsie', 'build', 'index.html'))
    })
} else {
    console.log('not in production', process.env.NODE_ENV)
}
app.use(morgan(':method :url :status :res[content-length] - :response-time ms'))
app.use(cors())
app.use(bodyParser.json())
app.use(compression())

// ---------- rate limiting --------------------//

let counter = 0 // simple ddos precaution

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'You have exceeded the 100 requests in 15 mins limit!',
    headers: true
})

//  apply to all requests, targetting each user
app.use(limiter)

const myLimiter = (req, res, next) => {
    counter++
    console.log('Total requests ', counter)
    // TODO: remove/reset this later
    if (counter > 5000) {
        return res.status(400).json('ummm... something went wrong')
    }
    next()
}
// apply to all requests, regardless of user
app.use(myLimiter)

//---------------------------------------

app.use(userRoutes)
app.use(wordRoutes)

// handle uncaught errors
app.use((req, res, next) => {
    const error = new Error('Route does not exist')
    error.status = 404
    next(error)
})

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    res.status(err.status || 500)
    res.json({ error: { message: err.message } })
})

const MONGO_URI = `mongodb+srv://${process.env.DB_UN}:${process.env.DB_PW}@cluster0-ohht9.azure.mongodb.net/${process.env.DB_NAME}?retryWrites=true&w    =majority`
mongoose
    .connect(MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        useCreateIndex: true
    })
    .then(() => {
        const PORT = process.env.PORT || 5000
        app.listen(PORT, () => {
            console.log(`Mixing it up on port ${PORT}`)
        })
    })
    .catch((err) => {
        console.log('error connecting to db: ', err.message)
    })
