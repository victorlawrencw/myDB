//CLOUD CODE
Moralis.Cloud.define("posts", async (request) => {
    //Loads 10 Posts each time User gets close to the bottom. projects will have something similar too.
    //ALSO WE HAVE TO LOAD POSTS RELATED TO PROJECTS THE USER WAS WATCHING
  const Posts = new Moralis.Query('Posts');

  if((request.params.user == undefined || request.params.user == '') && request.params.project == undefined){ Posts.containedIn("tags", request.params.tags);} //for loading posts related to certain tags
  else if(request.params.project) Posts.equalTo('referredTo', request.params.project); //for loading posts related to a project
  else if(request.params.user != request.params.me) Posts.equalTo('idu', request.params.user); //for loading posts related to a single user


  Posts.descending('createdAt');
  Posts.skip(request.params.start);
  if(request.params.user == undefined || request.params.user == '') Posts.limit(10);
  const results = await Posts.find();

  if(results.length<1){
    return 'no posts'
  }

  const ime = new Moralis.Query('users');
  ime.equalTo('user', request.params.me);
  const me = await ime.first();
  
  let newposts = [];
  for(let i = 0; i < results.length; i++) {
    //It will skip the posts that already exist. i.e 10 by 10
    const contents = results[i].get('contents');
    const user = results[i].get('user');
    const referred = results[i].get('referred');
    const likes = results[i].get('likes');
    const commentscount = results[i].get('comments');
    const quotes = results[i].get('quotes');
 
    let liked = '';
    let quoted = '';
    
    if(likes.indexOf(me.get('username')) > -1){ liked = 'lq'}
    if(quotes.indexOf(me.get('username')) > -1){ quoted = 'lq'}
    
    
    const qcomments = new Moralis.Query("Comments");
    qcomments.equalTo("post", results[i].id);
    const qrr = await qcomments.first();
    
    let cdata = {};
    //query for that single comment. maybe i will remove this. it wastes time and precious data
    if(qrr != undefined){

    let likedc = '';
    if(qrr.get('likes').indexOf(me.get('username')) > -1){likedc = 'lq'}
    
    cdata = {idu:qrr.get('idu'), id:qrr.id, user:qrr.get('user'), contents: qrr.get('contents'), likes: qrr.get('likes').length, likedc:likedc, attachments:qrr.get('attachments')}; //comment data    
  }
    else{cdata = {contents: ''}}
    
    newposts.push({id:results[i].id, idu:results[i].get('idu'), user:user, createdat:results[i].createdAt, attachments:results[i].get('attachments'), commentcount: commentscount, contents:contents, likes:likes.length, requotes:quotes.length, referred:referred, comment:cdata, liked:liked, quoted:quoted});
  }
    return newposts;
}
);

//Main Post load.
Moralis.Cloud.define("loadcomments", async (request) => {
  let allcomments = [];
  const qcomments = new Moralis.Query("Comments");
  qcomments.equalTo("post", request.params.post);
  qcomments.descending('createdAt');
  qcomments.skip(request.params.start);
  const qrr = await qcomments.find();
    if(qrr.length == 0){return 'no comments'}

    const me = new Moralis.Query('users');
    me.equalTo('user', request.params.me);
    await me.first();
  
    //For each comment
    for(let c = 0; c<qrr.length; c++){
      const likes = qrr[c].get('likes');
      let liked = '';
      if(likes.indexOf(me.get('username')) > -1){ liked = 'lq'}
      
      allcomments.push({id:qrr[c].id, createdat:qrr[c].createdAt, userid:qrr[c].get('idu'), user:qrr[c].get('user'), attachments:qrr[c].get('attachments'), contents: qrr[c].get('contents'), likes: likes.length, liked:liked});
    }
    
      return allcomments
});

//PROJECTS
Moralis.Cloud.define("projects", async (request) => {
  //Loads 10 Projects each time User gets close to the bottom.
  const Projects = new Moralis.Query('Projects');
  
  if(request.params.user == undefined || request.params.user == ''){Projects.containedIn("tags", request.params.tags); Projects.limit(10)}
  else if(request.params.user != request.params.me){Projects.equalTo('user', request.params.user)};

  if(request.params.sortby == 'oldest') Projects.descending('createdAt');
  if(request.params.sortby == 'latest') Projects.ascending('createdAt');
  else Projects.descending('createdAt');
  
  Projects.skip(request.params.start);
  const results = await Projects.find();
  
  if(results.length < 1){return 'no projects'}
  
  let newprojects = [];
  for(let i = 0; i < results.length; i++) {
    //It will skip the projects that already exist. i.e 10 by 10
    const summary = results[i].get('summary');
    const user = results[i].get('user'); //A simple object with three childs
    
    const transactions = new Moralis.Query('Transactions');
    transactions.equalTo('project', results[i].id);
    const trx = await transactions.find(); //get each transactions
    
    const senders = [];
    let sum = 0;
    for(let fh=0;fh<trx.length;fh++){
      const each = trx[fh];
      const am = each.get('amount');
      const sender = each.get('sender');
      //this prevents duplicate cases. a case where multiple transactions belong to a single user
      if(senders.indexOf(sender) == -1){
        senders.push(sender);
      }
      sum+=am
    }

    newprojects.push({id:results[i].id, idu:results[i].get('idu'), user:user, title:results[i].get('title'), image:results[i].get('image'), backers:senders.length, funded:sum, goal:results[i].get('goal'), summary:summary});
  }
  
    return newprojects;
}
);

Moralis.Cloud.define('loadproject', async (request) => {
  //Loads a Projects
  const Projects = new Moralis.Query('Projects');
  const results = await Projects.get(request.params.id);

    const contents = results.get('contents');
    const summary = results.get('summary');
    const user = results.get('user'); //A simple object with four childs

    const transactions = new Moralis.Query('Transactions');
    transactions.equalTo('project', request.params.id);
    const trx = await transactions.find(); //get each transactions related to that project
    
    const senders = [];
    let sum = 0;
    for(let fh=0;fh<trx.length;fh++){
      const each = trx[fh];
      const am = each.get('amount');
      const sender = each.get('sender');
      //this prevents duplicate cases. a case where multiple transactions belong to a single user
      if(senders.indexOf(sender) == -1){
        senders.push(sender);
      }
      sum+=am
    }

    const users = new Moralis.Query('users');
    users.equalTo('watchlist', request.params.id);
    const userss = await users.find();

    return {user:user, 
      id:results.id, 
      idu:results.get('idu'), 
      tags:results.get('tags'), 
      title: results.get('title'), 
      deadline:results.get('deadline'), 
      contents:contents, image:results.get('image'), 
      backers:senders.length, 
      funded:sum, 
      goal:results.get('goal'), 
      summary:summary, 
      watchers:userss.length
    };
});

Moralis.Cloud.define('getTransactions', async (request) => {

  const transactions = new Moralis.Query('Transactions');
  transactions.equalTo('project', request.params.id);
  const trx = await transactions.find(); //get each transactions
  
  const trans = [];

  let sum = 0;
  for(let fh=0;fh<trx.length;fh++){
    const each = trx[fh];
    const am = each.get('amount');
    const sender = each.get('sender');
    //this prevents duplicate cases. a case where multiple transactions belong to a single user

    trans.push({sender:sender, amount:am});
    sum+=am
  }

  return trans
});

//AFTER A SUCCESSFUL TRANSACTION
Moralis.Cloud.define("notify", async (info) => {
  const par = info.params;
  //info.param = {project id, project name}
  //ALWAYS REMEMBER ETH IS THE CURRENCY OF WEB3

   //SAVING TRANSACTION TO HIS ACCOUNT
   const qw = new Moralis.Query('users');
   qw.equalTo('user', par.user); //get the user using the id linking his private to his public account
   const results = await qw.first();

   const username = results.get('username');

   //VALIDATE PROJECT'S EXISTENCE AGAIN
  const proje = new Moralis.Query('Projects');
  await proje.get(info.params.id).then(async (wwg)=>{

    const Transactions = Moralis.Object.extend('Transactions');
    const trans = new Transactions();
    
    trans.set('sender', username);
    trans.set('project', par.id);
    trans.set('amount', Number(par.amount));
 
    await trans.save(null, {useMasterKey:true}).then(()=>{

   results.addUnique('projects_backed', par.id);

   results.save();
  })

    const notifs = Moralis.Object.extend('Notifications');
    const note = new notifs();

    note.set('message', `<div class="notifs" onclick="openproject('${wwg.id}')"><a onclick="openuser('${username}')">@${username}</a> Sent you ${(info.params.am).toString()}eth</div>`);
    note.set('to', wwg.get('idu'));
    note.set('type', 'transaction');

    await note.save(null, {useMasterKey:true})
  });
  
},

{
  fields: {receiver:{required:true, type:String}, id:{required:true, type:String}, amount:{required:true, type:String}, user:{required:true, type:String}},
  requireUser: true,
});


// LIKED AND BE LIKED SECTION... COMPLETED
Moralis.Cloud.define("like", async request => {
  let post = new Moralis.Object("Posts");
  post.id = request.params.postId;
  if(request.params.wh == 'add'){post.addUnique('likes', request.params.username)}
  else{ post.remove('likes', request.params.username)}

  await post.save(null, { useMasterKey: true });
  return 'done';
});

Moralis.Cloud.define("quote", async request => {
  let post = new Moralis.Object("Posts");
  post.id = request.params.postId;
  if(request.params.wh == 'add'){post.addUnique('quotes', request.params.username)}
  else{post.remove('quotes', request.params.username)}

  await post.save(null, { useMasterKey: true });
  return 'done'
});

Moralis.Cloud.define("like_comment", async request => {
  let post = new Moralis.Query("Comments");
  post.get(request.params.postId).then(async (post)=>{
    if(request.params.wh == 'add'){post.addUnique('likes', request.params.username)}
    else{ post.remove('likes', request.params.username)}
  
  await post.save(null, { useMasterKey: true });
  return 'done'
});
});
///

///A SIMPLE CLOUD CODE TO IMPORT USERINFO
Moralis.Cloud.define('userinfo', async (request) => {
  //all will be returned in numbers.
  //projects created by user
  const projects = new Moralis.Query('Projects');
  projects.equalTo('idu', request.params.user);
  const pcount = await projects.find();

  //how many supporters the user has
  let bcount = 0;
  if(pcount>0){
  for(let de = 0; de<pcount.length; de++){
    const stu = new Moralis.Query('users');
    stu.equalTo('projects_backed', pcount[de].id);
    const ui = await stu.find();
    bcount+=ui.length
  }
}
  //numbers of projects supported by the user him/her self
  const ryy = new Moralis.Query('users');
  ryy.equalTo('username', request.params.user);
  const supd = await ryy.first();

  return {projects:pcount.length, backers:bcount, supported:supd.get('projects_backed').length}
});
///USER SIMPLE QUERY


Moralis.Cloud.define('notifications', async (request) => {
  const notif = new Moralis.Query('Notifications');
  notif.equalTo('to', request.params.userSelf);
  const results = await notif.find({useMasterKey:true});

  const allnotifs = [];
  for(let ry = 0; ry<results.length; ry++){
   allnotifs.push({message:results[ry].get('message'), type:results[ry].get('type')})
  }

  return allnotifs; //returns an array of objects... {message, to, type}
});




/////*************************************//////
/////*************************************//////
//AFTER SAVES FOR POST... THEY CREATE NOTIFICATIONS FOR USERS
//It can only be fetched with masterkey
/////*************************************//////
/////*************************************//////

Moralis.Cloud.afterSave('Posts', async (req) => {
  const referredTo = req.context.referredto;
  //if the post refers to a certain project, it will be linked to it, and this will notify the people watching said project.
  const users = new Moralis.Query('users');
  users.containedIn('watchlist', referredTo); //select those who have the post in their watchlist
  await users.find().then(async (the_users)=>{
    //notify each user. fields... to=username. for=project. message=message and from:poster in html
    const message = 'A Post on this project was posted by user x';
    for(let ryu = 0; ryu<the_users.length;ryu++){
      //send notification to each user
      const notifs = Moralis.Object.extend('Notifications');
      const note = new notifs();
  
      note.set('message', `<div onclick="openpost('${req.context.pid}')"><a onclick="openuser('${req.context.uI.username}')">@${req.context.uI.username}</a> replied to your comment in a post</div>`);
      note.set('to', the_users.get('username'));
      note.set('type', 'post');

      await note.save(null, {useMasterKey:true})
    }
  },
  (error)=>{
    //there wasnt any users watching it
  }
  )
});


Moralis.Cloud.afterSave('Comments', async (req) => {
  const commenter = req.context.uI;
  if(req.context.comid != ''){
    const comments = new Moralis.Query('Comments');
    comments.get(req.context.comid).then((cobj)=>{

      const notifs = Moralis.Object.extend('Notifications');
      const note = new notifs();
  
      note.set('message', `<div onclick="openpost('${req.context.pid}')"><a onclick="openuser('${req.context.uI.username}')">@${req.context.uI.username}</a> replied to your comment in a post</div>`);
      note.set('to', cobj.get('idu'));
      note.set('type', 'comment');

      note.save(null, {useMasterKey:true})
    })
  }

  const posts = new Moralis.Query('Post');
  posts.get(req.context.pid).then((obj)=>{
    const notifs = Moralis.Object.extend('Notifications');
    const note = new notifs();

    note.set('message',  `<div onclick="openpost('${req.context.pid}')><a onclick="openuser('${req.context.uI.username}')">@${req.context.uI.username}</a> made a comment on your post</div>`);
    note.set('to', obj.get('idu'));
    note.set('type', 'comment');

    note.save(null, {useMasterKey:true});

    obj.increment('comments');
    obj.save();
  });
});


/////*************************************//////
/////*************************************//////
