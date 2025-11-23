const Joi = require('joi');


const adminSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(2).max(50).required(),
  username: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().required(),
  phone: Joi.string().pattern(/^09\d{9}$/).required().messages({
    "string.pattern.base": "شماره موبایل باید معتبر باشد (مثل 09XXXXXXXXX)"
  }),
  password: Joi.string().min(6).required()
});

module.exports =  {
    adminSchema
}