const express = require('express')
const axios = require('axios')
const Wordef = require('../models/wordef')
const User = require('../models/user')

const router = express.Router()
const API_URL = 'https://od-api.oxforddictionaries.com/api/v2/entries/en-gb/'

// this method only runs if the word is NOT in the application database
// function returns object containing all relevant word info in WordDef schema layout,
// or null if no match found
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
        console.log(err.message)
        throw new Error('error requesting from database')
    }
    if ('error' in wordObject) {
        throw new Error('error when fetching word from api')
    }

    // first object in lexicalEntries array contains word definitions and examples
    const wordInfo = wordObject.data.results[0].lexicalEntries[0]
    const definitions = [] // for storing 1+ definitions of a word
    let examplesPerDef = [] // there could be multiple examples for each word definition
    // loop through senses array to populate definitions
    wordInfo.entries[0].senses
        .filter((data) => 'examples' in data) // remove entries with no examples
        .forEach((def) => {
            def.examples.forEach((ex) => examplesPerDef.push(ex.text)) // extract string from object
            definitions.push({
                definition: def.definitions[0],
                examples: [...examplesPerDef],
            })
            examplesPerDef = []
        })

    const part = wordInfo.lexicalCategory.text
    // console.log("successful word retrieval: ", definitions);
    return { word, part, definitions }
}

// adds word to application database for faster future retrieval
// an error in this function does not impact client
const addWordToDB = ({ word, part, definitions }) => {
    if (!(word && part && definitions)) {
        throw new Error('can not add word to database')
    }
    try {
        const wordDef = new Wordef({
            word,
            part,
            definitions,
        })
        wordDef.save().catch((err) => {
            console.log('error saving word to database... ', err.message)
        })
    } catch (error) {
        console.error(error.message)
    }
}

router.get('/define', async (req, res) => {
    let { word } = req.query
    if (!word) {
        return res.status(400).json({ error: { message: 'no word to search' } })
    }
    // check mongo if word is already stored
    word = word.toLowerCase()
    try {
        const wordQuery = await Wordef.findOne({ word }) // returns null if no matches
        // return full word object if found in mongo
        if (wordQuery) {
            const { part, definitions } = wordQuery
            return res.status(200).json({
                word,
                part: part.toLowerCase(),
                definitions,
            })
        }

        // ----------- word not found in mongodb, therefore query api...
        const wordInfo = await fetchWordData(word)
        // store reference in DB
        if (wordInfo) {
            addWordToDB(wordInfo)
            return res.status(200).json(wordInfo)
        }

        return res.status(400).json({
            error: {
                message: 'error in lookup likely caused by non-word input'
            }
        })
    } catch (error) {
        return res.status(400).json({ error: { message: error.message } })
    }
})

// precondition: word was searched previously and therefore inside the application db
router.post('/addWordToCart', async (req, res) => {
    if (!req.userId) {
        // this route is only for logged in users
        return res.status(401).json({
            error: { message: 'Authorization denied trying to add word' },
        })
    }
    let word = req.body.word

    word = word.toLowerCase()
    try {
        const user = await User.findOne({ _id: req.userId }).exec()
        if (!user) {
            console.log("can't find user in mongo for some reason")
            return res
                .status(500)
                .json({ error: { message: 'unable to find user' } })
        }
        // find mongoose word object
        const wordObj = await Wordef.findOne({ word })
        // console.log("return from mongo: ", wordObj);
        if (!wordObj) {
            return res
                .status(500)
                .json({ error: { message: "can't find word in db" } })
        }
        user.addToCart(wordObj._id)
        return res.json(wordObj)
    } catch (err) {
        console.log(err)
    }
})

router.post('/removeWord', async (req, res) => {
    if (!req.userId) {
        // this case only here as precaution
        // this route is only for logged in users
        return res.status(400).json('Authorization denied trying to add word')
    }

    let wordId = req.body.wordId
    try {
        const user = await User.findOne({ _id: req.userId }).exec()
        if (!user) {
            return res.status(400).json('unable to find user profile on delete')
        }
        user.removeFromCart(wordId)
        res.status(200).json('success')
    } catch (e) {
        res.status(500).json('oops... something went wrong')
    }
})

router.post('/emptyCart', async (req, res) => {
    if (!req.userId) {
        // this case only here as precaution
        // this route is only for logged in users
        return res.status(400).json('Authorization denied trying to add word')
    }

    try {
        const user = await User.findOne({ _id: req.userId }).exec()
        if (!user) {
            return res
                .status(400)
                .json('unable to find user profile on delete all words')
        }
        user.emptyCart()
        return res.status(200).json('success')
    } catch (e) {
        res.status(500).json('oops... something went wrong')
    }
})

module.exports = router
