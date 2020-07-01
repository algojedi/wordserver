const mongoose = require('mongoose')

//defInfo must be seperate model because definition is tied to specific examples
const defInfo = mongoose.Schema(
    {
        definition: { type: String, required: true },
        examples: [{ type: String }],
    },
    { _id: false }
)

//TODO: combine the two schemas
const wordefSchema = mongoose.Schema({
    word: { type: String, required: true, unique: true },
    definitions: { type: [defInfo], required: true },
    part: { type: String, required: true }, //Part of Speech eg: noun, verb
})

module.exports = mongoose.model('Wordef', wordefSchema)
//mongoose will use lowercase plural form of model name for collection name - eg: wordefs
