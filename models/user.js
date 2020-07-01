const mongoose = require('mongoose')
const uniqueValidator = require('mongoose-unique-validator')

const Schema = mongoose.Schema

const userSchema = new Schema({
    name: {
        type: String,
        required: true,
    },
    password: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },

    cart: [{ type: Schema.Types.ObjectId, ref: 'Wordef' }],
})

//wordId must be of type ObjectId
userSchema.methods.addToCart = function (wordId) {
    for (var w of this.cart) {
        if (w.equals(wordId)) {
            console.log('word already exists in cart - user model schema')
            return //word already exists in cart, hence do nothing
        }
    }
    const updatedCart = [...this.cart]
    updatedCart.push(wordId)
    console.log('updated cart: ', updatedCart)
    this.cart = updatedCart
    return this.save()
}

//wordId to be of type ObjectId
userSchema.methods.removeFromCart = function(wordId) {
  const updatedCartItems = this.cart.filter(wordRef => {
    return !wordRef.equals(wordId)
  });
  if (this.cart.length == updatedCartItems.length) {
    console.log('no word removed from cart upon attempt... user model mongoose')
  }
  this.cart = updatedCartItems;
  return this.save();
};

userSchema.methods.emptyCart = function() {
  this.cart = [];
  console.log('mongoose model emptying cart method')
  return this.save();
};


userSchema.methods.clearCart = function () {
    this.cart = []
    console.log('in clear cart method')
    return this.save()
}

userSchema.plugin(uniqueValidator)

module.exports = mongoose.model('User', userSchema)
