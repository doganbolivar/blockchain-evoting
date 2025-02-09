// @ts-nocheck
const express = require('express');
const createError = require('http-errors');
const request = require('request');

const jwt = require('../helpers/jwt');
const db = require('../helpers/db');
const eth = require('../helpers/eth');
const rcrd = require('../helpers/recorder');

const atob = require('atob');

var env = null;
try {
  env = require(`${__dirname}/../environments/secretKey.json`);
} catch (error) {
  env = JSON.parse(process.env.secretKeyProduction);
}

const router = express.Router();

function userLoginModule(req, res, next) {
  return db.mySqlQuery(`
    SELECT id, nik, phone, email, role, name, pubKey, createdAt
    FROM users
    WHERE (nik = ? OR phone = ? OR email = ?) AND password = ?
  `, [req.body.username, req.body.username, req.body.username, req.body.password], (error, results, fields) => {
    if (error) return next(createError(500, error));
    else if (results.length <= 0) return next(createError(400, 'Username Atau Password Salah!'));
    else {
      if ('password' in results[0]) delete results[0].password;
      return res.status(200).json({
        info: '😚 Berhasil Login. Yeay! 🤩',
        result: {
          token: jwt.JwtEncode(results[0], ('rememberMe' in req.body && JSON.parse(req.body.rememberMe) == true))
        }
      });
    }
  });
}

function userCheckAccountModule(newUserData, res, next, registerMode) {
  let iNik = 0;
  let iPhone = 0;
  let iEmail = 0;
  let iPubKey = 0;
  if ('nik' in newUserData) {
    db.mySqlQuery(`
      SELECT id, nik, phone, email, pubKey
      FROM users
      WHERE nik = ?
    `, [newUserData.nik], (error, results, fields) => {
      if (error) return next(createError(500));
      else iNik = results.length;
    });
  }
  if ('phone' in newUserData) {
    db.mySqlQuery(`
      SELECT id, nik, phone, email, pubKey
      FROM users
      WHERE phone = ?
    `, [newUserData.phone], (error, results, fields) => {
      if (error) return next(createError(500));
      else iPhone = results.length;
    });
  }
  if ('email' in newUserData) {
    db.mySqlQuery(`
      SELECT id, nik, phone, email, pubKey
      FROM users
      WHERE email = ?
    `, [newUserData.email], (error, results, fields) => {
      if (error) return next(createError(500));
      else iEmail = results.length;
    });
  }
  if ('pubKey' in newUserData) {
    db.mySqlQuery(`
      SELECT id, nik, phone, email, pubKey
      FROM users
      WHERE pubKey = ?
    `, [newUserData.pubKey], (error, results, fields) => {
      if (error) return next(createError(500));
      else iPubKey = results.length;
    });
  }
  return setTimeout(() => {
    const reg = {};
    if(iNik > 0) reg.nik = 'Nik Sudah Terpakai';
    if(iPhone > 0) reg.phone = 'Nomor Telepon Sudah Terpakai';
    if(iEmail > 0) reg.email = 'Email Sudah Terpakai';
    if(iPubKey > 0) reg.pubKey = 'PubKey Sudah Terpakai';
    const index = Math.max(iNik, iPhone, iEmail, iPubKey);
    if(index > 0) {
      return res.status(400).json({
        info: '🙄 400 - Pendaftaran Gagal! 😪',
        result: {
          message: 'Data Akun Sudah Digunakan!',
          nik: reg.nik,
          phone: reg.phone,
          email: reg.email,
          pubKey: reg.pubKey
        }
      });
    }
    else {
      if (registerMode) return registerMode();
      return res.status(200).json({
        info: '😉 200 - Pendaftaran Dapat Dilakukan! 🤔',
        result: {
          message: 'Pendaftaran Dapat Dilanjutkan!'
        }
      });
    }
  }, 1000);
}

// GET `/api`
router.get('/', function(req, res, next) {
  return next(createError(404));
});

// GET `/api/coinbase`
router.get('/coinbase', function(req, res, next) {
  if (
    'accountAddress' in req.query && req.query.accountAddress != null && req.query.accountAddress != '' && req.query.accountAddress != undefined
  ) {
    return eth.web3GetAccountBalance(
      req.query.accountAddress,
      (errTrx, trxResultCoinbaseInWei) => {
        if (errTrx) return next(createError(500, errTrx));
        else {
          return res.status(200).json({
            info: '😍 200 - Check Koin Ethereum! 🥰',
            result: {
              wei: trxResultCoinbaseInWei,
              gwei: eth.fromWei(trxResultCoinbaseInWei, 'gwei'),
              ether: eth.fromWei(trxResultCoinbaseInWei, 'ether'),
              tether: eth.fromWei(trxResultCoinbaseInWei, 'tether')
            }
          });
        }
    })
  }
  return res.status(400).json({
    info: '🙄 400 - Check Koin Ethereum! 😪',
    result: {
      message: 'Data tidak valid atau tidak lengkap'
    }
  });
});

// POST `/api/fund`
router.post('/fund', function(req, res, next) {
  const decoded = jwt.JwtDecode(req, res, next);
  if (decoded == null || decoded == undefined) return;
  if (
    'amount' in req.body && req.body.amount != null && req.body.amount != '' && req.body.amount != undefined
  ) {
    const reqFund = {
      amount: req.body.amount,
      accountAddress: decoded.user.pubKey
    };
    return db.mySqlQuery(`
      INSERT INTO fund
      SET ?
    `, reqFund, (error, results, fields) => {
      if (error) return next(createError(500));
      else {
        return res.status(200).json({
          info: '😍 200 - Request Koin Ethereum! 🥰',
          result: {
            message: 'Permintaan Terlah Dikirim, Silahkan Tunggu 1x24 Jam'
          }
        });
      }
    });
  }
  return res.status(400).json({
    info: '🙄 400 - Request Koin Ethereum! 😪',
    result: {
      message: 'Data tidak valid atau tidak lengkap'
    }
  });
});

// GET `/api/fund`
router.get('/fund', function(req, res, next) {
  const decoded = jwt.JwtDecode(req, res, next);
  if (decoded == null || decoded == undefined) return;
  else if (decoded.user.role == 'admin') {
    return db.mySqlQuery(`
      SELECT id, funded, amount, accountAddress, createdAt
      FROM fund
      WHERE funded = 0
    `, null, (error, results, fields) => {
      if (error) return next(createError(500));
      return res.status(200).json({
        info: `😍 200 - Daftar Request Koin Ethereum! 🥰`,
        results: results
      });
    });
  }
  else next(createError(403));
});

// POST `/api/fund/:id`
router.post('/fund/:id', function(req, res, next) {
  const decoded = jwt.JwtDecode(req, res, next);
  if (decoded == null || decoded == undefined) return;
  else if (decoded.user.role == 'admin') {
    return db.mySqlQuery(`
      SELECT id, funded, amount, accountAddress
      FROM fund
      WHERE funded = 0 AND id = ?
    `, [req.params.id], (errorSql1, resultsSql1, fieldsSql1) => {
      if (errorSql1) return next(createError(400));
      else {
        if (resultsSql1.length <= 0) return next(createError(404));
        else {
          const requestedFundAccount = resultsSql1[0];
          return eth.web3TransferCoin(
            requestedFundAccount.accountAddress,
            requestedFundAccount.amount,
            'ether',
            (errTrx, trxFunded) => {
              if (errTrx) return next(createError(500, errTrx));
              else {
                // rcrd.recordTransaction(trxFunded);
                return db.mySqlQuery(`
                  UPDATE fund
                  SET funded = 1
                  WHERE id = ?
                `, [requestedFundAccount.id], (errorSql2, resultsSql2, fieldsSql2) => {
                  if (errorSql2) return next(createError(500));
                  else {
                    return res.status(200).json({
                      info: `😍 200 - Berhasil Menyetujui Request Koin Ethereum! 🥰`,
                      result: {
                        trxFunded
                      }
                    });
                  }
                });
              }
            }
          );
        }
      }
    });
  }
  else next(createError(403));
});

// POST `/api/login`
router.post('/login', function(req, res, next) {
  if ('username' in req.body && 'password' in req.body) {
    return userLoginModule(req, res, next);
  }
  return res.status(400).json({
    info: '🙄 400 - Pendaftaran Gagal! 😪',
    result: {
      message: 'Data tidak valid atau tidak lengkap'
    }
  });
});

// POST `/api/verify`
router.post('/verify', function(req, res, next) {
  const decoded = jwt.JwtDecode(req, res, next);
  if (decoded == null || decoded == undefined) return;
  return res.status(200).json({
    info: '😍 200 - Token Selesai Di Verifikasi! UwUu~ 🥰',
    result: decoded
  });
});

// POST `/api/check-account`
router.post('/check-account', function(req, res, next) {
  let newUserData = req.body;
  if (
    'nik' in newUserData ||
    'email' in newUserData ||
    'phone' in newUserData
  ) {
    if ('nik' in newUserData) newUserData.nik = newUserData.nik.replace(/[^0-9]+/g, '');
    if ('phone' in newUserData) newUserData.phone = newUserData.phone.replace(/[^0-9]+/g, '');
    if ('email' in newUserData) newUserData.email = newUserData.email.replace(/[^0-9a-zA-Z@.]+/g, '');
    if (
      (newUserData.nik != null &&  newUserData.nik != '' &&  newUserData.nik != undefined) ||
      (newUserData.phone != null &&  newUserData.phone != '' &&  newUserData.phone != undefined) ||
      (newUserData.email != null &&  newUserData.email != '' &&  newUserData.email != undefined)
    ) {
      return userCheckAccountModule(newUserData, res, next, null);
    }
  }
  return res.status(400).json({
    info: '🙄 400 - Pendaftaran Gagal! 😪',
    result: {
      message: 'Data tidak valid atau tidak lengkap'
    }
  });
});

// POST `/api/register`
router.post('/register', function(req, res, next) {
  let newUserData = req.body;
  if (
    'nik' in newUserData &&
    'name' in newUserData &&
    'email' in newUserData &&
    'phone' in newUserData &&
    'pubKey' in newUserData &&
    'password' in newUserData
  ) {
    newUserData.nik = newUserData.nik.replace(/[^0-9]+/g, '');
    newUserData.phone = newUserData.phone.replace(/[^0-9]+/g, '');
    newUserData.email = newUserData.email.replace(/[^0-9a-zA-Z@.]+/g, '');
    newUserData.name = newUserData.name.replace(/[^a-zA-Z\s]+/g, '');
    if (
      newUserData.nik != null &&  newUserData.nik != '' &&  newUserData.nik != undefined &&
      newUserData.phone != null &&  newUserData.phone != '' &&  newUserData.phone != undefined &&
      newUserData.email != null &&  newUserData.email != '' &&  newUserData.email != undefined &&
      newUserData.name != null &&  newUserData.name != '' &&  newUserData.name != undefined &&
      newUserData.pubKey != null &&  newUserData.pubKey != '' &&  newUserData.pubKey != undefined &&
      newUserData.password != null &&  newUserData.password != '' &&  newUserData.password != undefined
    ) {
      return userCheckAccountModule(newUserData, res, next, () => {
        if(newUserData.password.length >= 128) {
          newUserData.nik = parseInt(newUserData.nik);
          newUserData.phone = newUserData.phone.toLowerCase();
          newUserData.email = newUserData.email.toLowerCase();
          newUserData.pubKey = newUserData.pubKey.toLowerCase();
          newUserData.password = newUserData.password.toLowerCase();
          return db.mySqlQuery(`
            INSERT INTO users
            SET ?`
          , newUserData, (error, results, fields) => {
            if (error) return next(createError(500));
            else {
              return userLoginModule({
                body: {
                  username: newUserData.nik || newUserData.phone || newUserData.email,
                  password: newUserData.password
                }
              }, res, next);
            }
          });
        }
        return res.status(400).json({
          info: '🙄 400 - Pendaftaran Gagal! 😪',
          result: {
            message: 'Password should be hashed using SHA512'
          }
        });
      });
    }
  }
  return res.status(400).json({
    info: '🙄 400 - Pendaftaran Gagal! 😪',
    result: {
      message: 'Data tidak valid atau tidak lengkap'
    }
  });
});

// POST `/api/new-eth-account`
router.post('/new-eth-account', function(req, res, next) {
  const newUserData = req.body;
  if (
    'password' in newUserData &&
    newUserData.password != null &&
    newUserData.password != '' &&
    newUserData.password != undefined
  ) {
    return eth.web3CreateAccount(
      atob(newUserData.password),
      (error, result) => {
        if (error) return next(createError(400));
        // rcrd.recordTransaction(result.trxTransferCoin);
        return res.status(200).json({
          info: '😍 200 - Berhasil Membuat Akun Ethereum! 🥰',
          result
        });
      }
    );
  }
  return res.status(400).json({
    info: '🙄 400 - Pendaftaran Gagal! 😪',
    result: {
      message: 'Data tidak valid atau tidak lengkap'
    }
  });
});

// POST `/api/import-eth-account`
router.post('/import-eth-account', function(req, res, next) {
  const newUserData = req.body;
  if (
    (
      'wallet' in newUserData &&
      newUserData.wallet != null &&
      newUserData.wallet != '' &&
      newUserData.wallet != undefined
    ) && (
      'secretKey' in newUserData &&
      newUserData.secretKey != null &&
      newUserData.secretKey != '' &&
      newUserData.secretKey != undefined
    ) && (
      'password' in newUserData &&
      newUserData.password != null &&
      newUserData.password != '' &&
      newUserData.password != undefined
    )
  ) {
    const callbackImportEthAccount = (error, result) => {
      if (error) {
        return res.status(400).json({
          info: '🙄 400 - Data File Tidak Valid! 😪',
          result: {
            message: error.message
          }
        }); 
      }
      // rcrd.recordTransaction(result.trxTransferCoin);
      return res.status(200).json({
        info: '😍 200 - Berhasil Import Akun Ethereum! 🥰',
        result
      });
    }
    if (!newUserData.wallet) {
      return eth.web3ImportAccountFromPrivKey(
        atob(newUserData.password),
        newUserData.secretKey,
        callbackImportEthAccount
      );
    }
    else {
      return eth.web3ImportAccountFromUtc(
        atob(newUserData.password),
        JSON.parse(newUserData.secretKey),
        callbackImportEthAccount
      );
    }
  }
  return res.status(400).json({
    info: '🙄 400 - Pendaftaran Gagal! 😪',
    result: {
      message: 'Data tidak valid atau tidak lengkap'
    }
  });
});

// GET `/api/block`
router.get('/block', function(req, res, next) {
  const page = parseInt(req.query.page) || 1;
  let row = parseInt(req.query.row) || 10;
  if (row >= 100) row = 100;
  return eth.web3GetLastestBlocks(page, row, (error, result) => {
    if (error) return next(createError(500, error));
    else {
      return res.status(200).json({
        info: `😲 200 - Latest Blocks! 😝`,
        results: result
      });
    }
  });
});

// GET `/api/block/:blockHash`
router.get('/block/:blockHash', function(req, res, next) {
  const showDetail = (req.query.showDetail == 'true');
  return eth.web3GetBlock(req.params.blockHash, showDetail, (error, result) => {
    if (error) return next(createError(500, error));
    else {
      return res.status(200).json({
        info: `😲 200 - Block ${req.params.blockHash}! 😝`,
        result: result
      });
    }
  });
});

// GET `/api/transaction/:transactionHash`
router.get('/transaction/:transactionHash', function(req, res, next) {
  return eth.web3GetTransaction(req.params.transactionHash, (error, result) => {
    if (error) return next(createError(500, error));
    else {
      return res.status(200).json({
        info: `😲 200 - Transaction ${req.params.transactionHash}! 😝`,
        result: result
      });
    }
  });
});

// GET `/api/signer`
router.get('/signer', function(req, res, next) {
  return request({
    method: 'POST',
    uri: `http://${env.gethIp}:9002`,
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: 'clique_getSigners',
      params: [],
      id: 1
    })
  }, (error, result, body) => {
    if (error) return next(createError(500));
    return res.json({
      info: '😲 200 - Daftar Seluruh Signer / Sealer / Miner! 😝',
      results: JSON.parse(body).result
    });
  });
});

// POST `/api/signer`
router.post('/signer', function(req, res, next) {
  const decoded = jwt.JwtDecode(req, res, next);
  if (decoded == null || decoded == undefined) return;
  else if (decoded.user.role == 'admin') {
    if ('address' in req.body) {
      return request({
        method: 'POST',
        uri: `http://${env.gethIp}:9002`,
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: 'clique_propose',
          params: [req.body.address, true],
          id: 1
        })
      }, (error, result, body) => {
        if (error) return next(createError(500));
        return res.json({
          info: `😲 200 - Pendaftaran Gagal! 😝`,
          results: JSON.parse(body).result
        });
      });
    }
    return res.status(400).json({
      info: '🙄 400 - Pendaftaran Gagal! 😪',
      result: {
        message: 'Data tidak valid atau tidak lengkap'
      }
    });
  }
  else next(createError(403));
});

// GET `/api/signer/:blockHash`
router.get('/signer/:blockHash', function(req, res, next) {
  return request({
    method: 'POST',
    uri: `http://${env.gethIp}:9002`,
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: 'clique_getSignersAtHash',
      params: [req.params.blockHash],
      id: 1
    })
  }, (error, result, body) => {
    if (error) return next(createError(500));
    return res.json({
      info: `😲 200 - Signer Blok ${req.params.blockHash} 😝`,
      results: JSON.parse(body).result
    });
  });
});

module.exports = router;
