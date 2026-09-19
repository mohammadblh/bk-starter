'use strict';

/**
 * میدلور ولیدیشن مشترک بر پایه Joi.
 *
 * نقش امنیتی مهم: Joi هر مقدار غیر-string را رد می‌کند، بنابراین
 * اپراتورهای MongoDB مثل {"$gt": ""} هرگز به لایه‌ی کوئری نمی‌رسند.
 *
 * مقدار validate شده جایگزین ورودی خام می‌شود تا فیلدهای ناشناخته
 * (mass assignment) حذف شوند.
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      return res.status(400).json({
        message: 'خطا در اعتبارسنجی اطلاعات',
        details: error.details.map(d => d.message),
      });
    }

    // req.query در Express 4 قابل بازنویسی است؛ برای ایمنی از
    // Object.defineProperty استفاده می‌کنیم تا در Express 5 هم کار کند.
    if (source === 'query') {
      Object.defineProperty(req, 'validatedQuery', { value, writable: false, configurable: true });
    } else {
      req[source] = value;
    }

    return next();
  };
}

module.exports = { validate };
