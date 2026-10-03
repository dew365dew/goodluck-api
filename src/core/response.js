function success(res, data = null, message = 'Success') {
  return res.status(200).json({
    success: true,
    message,
    data,
  });
}

function created(res, data = null, message = 'Created') {
  return res.status(201).json({
    success: true,
    message,
    data,
  });
}

function error(
  res,
  message = 'Internal Server Error',
  status = 500
) {
  return res.status(status).json({
    success: false,
    message,
  });
}

module.exports = {
  success,
  created,
  error,
};