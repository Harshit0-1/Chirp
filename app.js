const express = require('express')
const app = express()
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const path = require('path')
const dbPath = path.join(__dirname, 'twitterClone.db')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')
let db
app.use(express.json())
const dbIntializer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => console.log('server is running on 3000'))
  } catch (e) {
    console.log(e)
  }
}
dbIntializer()

//logger middleware
const logger = (req, res, next) => {
  const header = req.headers['authorization']
  let token
  if (header !== undefined) {
    token = header.split(' ')[1]
    console.log(token)
  }
  if (header === undefined) {
    res.status(401)
    res.send('Invalid JWT Token')
  } else {
    jwt.verify(token, 'rm', (err, payload) => {
      if (err) {
        res.status(401)
        res.send('Invalid JWT Token')
      } else {
        req.username = payload.username
        next()
      }
    })
  }
}

app.get('/register/', logger, async (req, res) => {
  const query = `select * from user`
  const ans = await db.all(query)
  res.send(ans)
})

// get user id
const getUserId = async req => {
  let username = req.username
  let query = `select user_id from user where username = "${username}"`
  let ans = await db.get(query)
  return ans.user_id
}

// get tweet_id in list
const get_tweet_id = async user_id => {
  const getFollowingUser = `select tweet.tweet_id from follower inner join tweet on follower.following_user_id = tweet.user_id where follower.follower_user_id = ${user_id}`
  let ans = await db.all(getFollowingUser)
  const following_tweet_id = []
  ans.map(id => following_tweet_id.push(id.tweet_id))
  return following_tweet_id
}

//api 1
app.post('/register/', async (req, res) => {
  const {username, password, name, gender} = req.body
  console.log(password.length)
  let query = `select * from user where username = "${username}"`
  let ans = await db.get(query)
  if (ans !== undefined) {
    res.status(400)
    res.send('User already exists')
  } else {
    if (password.length > 6) {
      const hasedPass = await bcrypt.hash(password, 10)
      query = `insert into user(name , username ,password, gender) 
      values("${name}" , "${username}" , "${hasedPass}" , "${gender}")`
      ans = db.run(query)

      res.send('User created successfully')
    } else {
      res.status(400)
      res.send('Password is too short')
    }
  }
})

// api 2
app.post('/login/', async (req, res) => {
  const {username, password} = req.body
  let query = `select * from user where username = "${username}"`
  let ans = await db.get(query)
  if (ans === undefined) {
    res.status(400)
    res.send('Invalid user')
  } else {
    const comparePass = await bcrypt.compare(password, ans.password)
    if (comparePass) {
      payload = {username: username}
      jwtToken = jwt.sign(payload, 'rm')
      res.send({jwtToken: jwtToken})
    } else {
      res.status(400)
      res.send('Invalid password')
    }
  }
})

//api3
app.get('/user/tweets/feed/', logger, async (req, res) => {
  const user_id = await getUserId(req)

  query = `select user.username , tweet.tweet , tweet.date_time as dateTime from 
  (follower inner join tweet on follower.following_user_id = tweet.user_id) as t 
  inner join user on t.user_id = user.user_id
  where follower_user_id = ${user_id}
  limit 4`
  ans = await db.all(query)
  res.send(ans)
})

//api 4
app.get('/user/following/', logger, async (req, res) => {
  const user_id = await getUserId(req)
  const query = `select name from follower inner join user on follower.following_user_id = user.user_id where follower_user_id = ${user_id}`
  const ans = await db.all(query)
  res.send(ans)
})

//api 5
app.get('/user/followers/', logger, async (req, res) => {
  const user_id = await getUserId(req)
  const query = `select name from follower inner join user on user.user_id = follower.follower_user_id where following_user_id = ${user_id}`
  const ans = await db.all(query)
  res.send(ans)
})

//api 6
app.get('/tweets/:tweetId/', logger, async (req, res) => {
  const user_id = await getUserId(req)
  let {tweetId} = req.params
  listId = []

  // let query = `select tweet_id from (follower inner join user on follower.following_user_id = user.user_id) as t inner join tweet on t.following_user_id = tweet.user_id where follower_user_id = ${user_id}`
  let query = `select * from follower inner join tweet on follower.following_user_id = tweet.user_id where follower_user_id = ${user_id}`
  let ans = await db.all(query)

  ans.map(id => listId.push(id.tweet_id))
  console.log(typeof listId[0])
  console.log(listId.includes(tweetId))
  tweetId = Number(tweetId)
  console.log(listId)
  if (listId.includes(tweetId)) {
    // query = `select tweet.tweet , count(*) as likes ,count(reply.tweet_id) as replies , tweet.date_time from (tweet
    // inner join like on tweet.tweet_id = like.tweet_id ) as t inner join reply on t.tweet_id = reply.tweet_id
    // where tweet.tweet_id = ${tweetId}
    // group by tweet.tweet_id`
    query = `select tweet.tweet , count(distinct like.like_id) as like , count(distinct reply.reply_id) as reply, tweet.date_time as dateTime from (tweet  left join like on tweet.tweet_id = like.tweet_id) as t 
    left join reply on reply.tweet_id = t.tweet_id
    where t.tweet_id = ${tweetId}
    group by t.tweet_id
    
    `
    ans = await db.get(query)
    res.send(ans)
  } else {
    res.status(400)
    res.send('Invalid Request')
  }
  // res.send(ans)
})

//api7
app.get('/tweets/:tweetId/likes/', logger, async (req, res) => {
  const user_id = await getUserId(req)
  const list_tweet_id = await get_tweet_id(user_id)
  let {tweetId} = req.params
  tweetId = Number(tweetId)

  if (list_tweet_id.includes(tweetId)) {
    query = `select user.username from like inner join user on user.user_id = like.user_id where like.tweet_id = ${tweetId}`

    ans = await db.all(query)
    let like_name_list = ans.map(name => name.username)

    console.log(like_name_list)

    res.send({
      likes: like_name_list,
    })
  } else {
    res.status(401)
    res.send('Invalid Request')
  }
})

//api 8
app.get('/tweets/:tweetId/replies/', logger, async (req, res) => {
  const user_id = await getUserId(req)
  const list_tweet_id = await get_tweet_id(user_id)
  console.log(list_tweet_id)
  let {tweetId} = req.params
  tweetId = Number(tweetId)
  if (list_tweet_id.includes(tweetId)) {
    const query = `select user.name , reply.reply from reply inner join user on user.user_id = reply.user_id where tweet_id = ${tweetId}`
    const ans = await db.all(query)

    const final_ans = ans.map(reply => reply)
    const obj = {replies: final_ans}
    res.send(obj)
  } else {
    res.status(401)
    res.send('Invalid Request')
  }
})

app.get('/user/tweets/', logger, async (req, res) => {
  const user_id = await getUserId(req)
  const query = `select tweet.tweet , count(distinct like.like_id) as likes , count(distinct reply.reply_id) as replies ,tweet.date_time as dateTime from (tweet left join like on tweet.tweet_id = like.tweet_id) as t left join reply on t.tweet_id = reply.tweet_id where tweet.user_id = ${user_id} group by t.tweet_id`
  const ans = await db.all(query)
  res.send(ans)
})

app.post('/user/tweets/', logger, async (req, res) => {
  const user_id = await getUserId(req)
  const {tweet} = req.body
  const date = new Date()
  const datetime = date.toLocaleString()

  const query = `insert into tweet(tweet , user_id , date_time) values("${tweet}" , ${user_id} , "${datetime}")`
  const ans = await db.run(query)
  res.send('Created a Tweet')
})

// last
app.delete('/tweets/:tweetId/', logger, async (req, res) => {
  const user_id = await getUserId(req)
  let {tweetId} = req.params
  tweetId = Number(tweetId)
  console.log(tweetId)
  let query = `select tweet_id from tweet where user_id = ${user_id}`

  let ans = await db.all(query)
  const list_tweet_id = ans.map(id => id.tweet_id)
  console.log(list_tweet_id)
  if (list_tweet_id.includes(tweetId)) {
    query = `delete from tweet where tweet_id = ${tweetId}`
    ans = db.run(query)
    res.send('Tweet Removed')
  } else {
    res.status(401)
    res.send('Invalid Request')
  }
})

module.exports = app
