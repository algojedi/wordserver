const express = require('express')
const bodyParser = require('body-parser')
const path = require('path')
const cors = require('cors')
const axios = require('axios')
const mongoose = require('mongoose')
const authRoutes = require('./routes/auth')
const Session = require('./models/session')

require('dotenv').config()
const app = express()

app.use(express.static(path.join(__dirname, 'wordsie', 'build')))
;-app.get('/', function (req, res) {
    ;+app.get('/*', function (req, res) {
        res.sendFile(path.join(__dirname, 'wordsie', 'build', 'index.html'))
    })
})

const MONGO_URI = `mongodb+srv://${process.env.DB_UN}:${process.env.DB_PW}@cluster0-ohht9.azure.mongodb.net/test?retryWrites=true&w=majority`

//user saved in session upon login is not a mongoose recognizable model (has no methods)
//we retrieve the model via user._id

app.use(cors())
app.use(bodyParser.json())
app.use(authRoutes)

const API_URL = 'https://od-api.oxforddictionaries.com/api/v2/entries/en-gb/'

//TODO: ***** put routes in seperate routes folder with dedicated controllers


const Wordef = require('./models/wordef')
const User = require('./models/user')

//this method only runs if the word is NOT in the database
//function returns object containing all relevant word info in WordDef schema layout, or null if no match found
const fetchWordData = async (word) => {
    let wordObject = {}

    try {
        wordObject = await axios.get(API_URL + word, {
            headers: {
                app_id: process.env.APP_ID,
                app_key: process.env.API_KEY,
            },
        })
    } catch (err) {
        console.log('error when fetching for api', err)
    }
    if ('error' in wordObject) {
        console.log(wordObject.error)
        return null
    }

    //first object in lexicalEntries array contains word definitions and examples
    const wordInfo = wordObject.data.results[0].lexicalEntries[0]
    const definitions = [] //for storing 1+ definitions of a word
    let examplesPerDef = [] //there could be multiple examples for each word definition
    //loop through senses array to populate definitions
    wordInfo.entries[0].senses
        .filter((data) => 'examples' in data) //remove entries with no examples
        .forEach((def) => {
            //console.log('def is ', def);
            def.examples.forEach((ex) => examplesPerDef.push(ex.text)) //extract string from object

            definitions.push({
                definition: def.definitions[0],
                examples: [...examplesPerDef],
            })
            examplesPerDef = []
        })

    const part = wordInfo.lexicalCategory.text
    console.log('successful word retrieval: ', definitions)
    return { word, part, definitions }
}

app.get('/define', async (req, res) => {
    const word = req.query.word
    if (!word) {
        return res.json('Enter a word')
    }
    //check mongo if word is already stored
    try {
        const wordQuery = await Wordef.findOne({ word }) //returns null if no matches
        //return full word object if found in mongo
        if (wordQuery) {
            console.log('word defs from mongodb: ', wordQuery.definitions)
            const { part, definitions } = wordQuery
            return res.send({
                word,
                part,
                definitions,
            })
        }

        //not found in mongodb, therefor query api...
        //const wordInfo = await fetchWordInfo(word);
        const wordInfo = await fetchWordData(word)

        //store reference in DB
        if (wordInfo) {
            await addWordToDB(wordInfo)
        }
        return res.json(wordInfo)
    } catch (error) {
        console.error(error)
        res.status(400).send()
    }
})

const addWordToDB = ({ word, part, definitions }) => {
    try {
        const wordDef = new Wordef({
            word,
            part,
            definitions,
        })
        wordDef.save().then((result) => {
            //save() will save to DB
            console.log('result from saving word to DB, ', result)
        })
    } catch (error) {
        console.error(error)
    }
}

app.post('/addWordToCart', async (req, res) => {
    const { authorization } = req.headers //authorization is the token
    let word = req.body.word
    console.log('the req body object is in data? ', req.body)
    word = word.toLowerCase()
    try {
        const sesh = await Session.findOne({ token: authorization }).exec()
        if (!sesh) {
            console.log('invalid token addwordtocart ', err)
            return res
                .status(400)
                .json('Authorization denied trying to add word')
        }
        const user = await User.findOne({ _id: sesh.userId }).exec()
        if (!user) {
            return res.status(400).json('unable to find user in addWord route')
        }
        //find mongoose word object
        const wordObj = await Wordef.findOne({ word: word })
        if (!wordObj) {
            return resp.status(400).send("can't find word in db")
        }
        console.log('word from mongo in addword route ', wordObj)
        user.addToCart(wordObj._id)
        return res.json(wordObj)
    } catch (err) {
        console.log(err)
    }
})

//temp route to act as root
app.get('/home', (req, res) => {
    return res.send('<h1>Hello other there!</h1>')
})

app.get('/getCart', async (req, res) => {
    const userId = '5e38399819864a04d8c90b44' //user John Lennon in db
    user = await User.findById(userId)
    if (!user) {
        return res.status(400).json('unable to find user in addWord route')
    }
    User.findOne({ _id: user._id })
        .populate('cart') // only works if we pushed refs to children
        .exec(function (err, person) {
            if (err) {
                return console.log(err)
            }
            console.log(person)
            res.json(person.cart)
        })
})

//takes in a word as a parameter
app.get('/', async (req, res) => {
    const word = req.query.word

    if (!word) {
        return res.send('<h3>Enter a word</h3>')
    }
})

app.post('/removeWord', async (req, res) => {
    const { authorization } = req.headers //authorization is the token
    let wordId = req.body.wordId
    try {
        const sesh = await Session.findOne({ token: authorization }).exec()
        if (!sesh) {
            console.log('invalid token removeword route ', err)
            return res
                .status(400)
                .json('Authorization denied trying to remove word')
        }
        const user = await User.findOne({ _id: sesh.userId }).exec()
        if (!user) {
            return res
                .status(400)
                .json('unable to find user in remove word route')
        }
        user.removeFromCart(wordId)
        res.status(200).send()
    } catch (e) {
        console.log('error in route remove word', e)
        res.status(400).send()
    }
})

//TODO: cart does not empty in db
app.get('/emptyCart', async (req, res) => {
    const userId = '5e1cbaed7f37fe29f8f2aaf8' //user Jake in db
    user = await User.findById(userId)
    if (!user) {
        return res.status(400).json('unable to find user in addWord route')
    }
    try {
        user.clearCart()
        return res.json('emptied cart')
    } catch (e) {
        console.log('error in route empty cart', e)
        res.send(400)
    }
})

app.get('/test', async (req, res) => {
    const word = req.query.word
    try {
        const wordObject = await axios.get(API_URL + word, {
            headers: {
                app_id: process.env.APP_ID,
                app_key: process.env.API_KEY,
            },
        })
        if ('error' in wordObject) {
            console.log(wordObject.error)
            return null
        }
        return res.send(wordObject)
    } catch (error) {
        console.error(error)
        res.status(400).send()
    }
})

mongoose
    .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then((result) => {
        const PORT = process.env.PORT || 3001
        app.listen(PORT, () => {
            console.log(`Mixing it up on port ${PORT}`)
        })
    })
    .catch((err) => {
        console.log(err)
    })
