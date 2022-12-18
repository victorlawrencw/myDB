/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-var-requires */
declare const Parse: any;
import './generated/evmApi';
import './generated/solApi';
import { requestMessage } from '../auth/authService';

//CLOUD CODE
Parse.Cloud.define('requestMessage', async ({ params }: any) => {
  const { address, chain, networkType } = params;

  const message = await requestMessage({
    address,
    chain,
    networkType,
  });

  return { message };
});

Parse.Cloud.define('getPluginSpecs', () => {
  // Not implemented, only excists to remove client-side errors when using the moralis-v1 package
  return [];
});

Parse.Cloud.define('getServerTime', () => {
  // Not implemented, only exists to remove client-side errors when using the moralis-v1 package
  return null;
});

//CLOUD CODE
//Gather and sort data on the cloud --> the multiple posts page doesnt need to have more than one comment per post, to save user's data.
//While the Main Post need to have multiple comment based on one post. I aint stressing with showing repost(till I'm free to add other non-necessities).
//USERID IS FOR FINDING USERS IN THE DATABASE, SINCE ITS UNCHANGABLE, WHILE USERNAME IS FOR PUBLIC CLIENT-SIDE SEARCHES
//Im having some issues with limit()

Parse.Cloud.define("posts", async ({request}:any) => {
    //Loads 10 Posts each time User gets close to the bottom. projects will have something similar too.
    //ALSO WE HAVE TO LOAD POSTS RELATED TO PROJECTS THE USER WAS WATCHING
  const Posts = new Parse.Query('Posts');

  if((request.params.user == undefined || request.params.user == '') && request.params.project == undefined){ Posts.containedIn("tags", request.params.tags);} //for loading posts related to certain tags
  else if(request.params.project) Posts.equalTo('referredTo', request.params.project); //for loading posts related to a project
  else if(request.params.user) Posts.equalTo('idu', request.params.user); //for loading posts related to a single user

  Posts.descending('createdAt');
  Posts.skip(request.params.start);
  if(request.params.user == undefined || request.params.user == '') Posts.limit(10);
  const results = await Posts.find();

  if(results.length<1){
    return 'no posts'
  }

  const ime = new Parse.Query('users');
  ime.equalTo('username', request.params.me);
  const me = await ime.first();
  
  let newposts:Array<object> = [];
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
    
    
    const qcomments = new Parse.Query("Comments");
    qcomments.equalTo("post", results[i].id);
    const qrr = await qcomments.first();
    
    let cdata:object = {};
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
Parse.Cloud.define("loadcomments", async ({request}:any) => {
  let allcomments:Array<object> = [];
  const qcomments = new Parse.Query("Comments");
  qcomments.equalTo("post", request.params.post);
  qcomments.descending('createdAt');
  qcomments.skip(request.params.start);
  const qrr = await qcomments.find();
    if(qrr.length == 0){return 'no comments'}

    const me = new Parse.Query('users');
    me.equalTo('username', request.params.me);
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
Parse.Cloud.define("projects", async ({request}:any) => {
  //Loads 10 Projects each time User gets close to the bottom.
  const Projects = new Parse.Query('Projects');
  
  if(request.params.user == undefined || request.params.user == ''){Projects.containedIn("tags", request.params.tags); Projects.limit(10)}
  else if(request.params.user != request.params.me){Projects.equalTo('idu', request.params.user)};

  if(request.params.sortby == 'oldest') Projects.descending('createdAt');
  if(request.params.sortby == 'latest') Projects.ascending('createdAt');
  else Projects.descending('createdAt');
  
  Projects.skip(request.params.start);
  const results = await Projects.find();
  
  if(results.length < 1){return 'no projects'}
  
  let newprojects:Array<object> = [];
  for(let i = 0; i < results.length; i++){
    //It will skip the projects that already exist. i.e 10 by 10
    const summary = results[i].get('summary');
    const user = results[i].get('idu'); //A simple object with three childs
    
    const transactions = new Parse.Query('Transactions');
    transactions.equalTo('project', results[i].id);
    const trx = await transactions.find(); //get each transactions
    
    const senders:Array<string> = [];
    const eachtr:Array<any> = [];

    let sum = 0;
    let sum2 = 0;
    for(let fh=0;fh<trx.length;fh++){
      const each = trx[fh];
      const am = each.get('amount');
      const sender = each.get('sender');
      //this prevents duplicate cases. a case where multiple transactions belong to a single user
      if(senders.indexOf(sender) == -1){
        senders.push(sender);
      }
      
      if(each.get('network') == 'polygon') sum+=am;
      else sum2+=am

      eachtr.push({sender:sender, network:each.get('network'), amount:each.get('amount')})
    }

    newprojects.push({
      id:results[i].id,
      idu:results[i].get('idu'),
      user:user,
      title:results[i].get('title'),
      image:results[i].get('image'),
      backers:senders.length,
      funded:sum,
      fundedfantom:sum2,
      goal:results[i].get('goal'),
      summary:summary
    });
  }
  
    return newprojects;
}
);

Parse.Cloud.define('loadproject', async ({request}:any) => {
  //Loads a Projects
  const Projects = new Parse.Query('Projects');
  const results = await Projects.get(request.params.id);

    const contents = results.get('contents');
    const summary = results.get('summary');
    const user = results.get('user'); //A simple object with four childs

    const transactions = new Parse.Query('Transactions');
    transactions.equalTo('project', request.params.id);
    const trx = await transactions.find(); //get each transactions related to that project
    
    const senders:Array<string> = [];
    const eachtr:Array<any> = [];

    let sum = 0;
    let sum2 = 0;
    for(let fh=0;fh<trx.length;fh++){
      const each = trx[fh];
      const am = each.get('amount');
      const sender = each.get('sender');
      //this prevents duplicate cases. a case where multiple transactions belong to a single user
      if(senders.indexOf(sender) == -1){
        senders.push(sender);
      }
      
      if(each.get('network') == 'polygon') sum+=am;
      else sum2+=am

      eachtr.push({sender:sender, network:each.get('network'), amount:each.get('amount')})
    }

    const users = new Parse.Query('users');
    users.equalTo('watchlist', request.params.id);
    const userss = await users.find();
    
    return {user:user, 
      id:results.id,
      idu:results.get('idu'), 
      tags:results.get('tags'), 
      title: results.get('title'), 
      deadline:results.get('deadline'), 
      contents:contents,
      image:results.get('image'), 
      backers:senders.length,
      transactions:eachtr,
      funded:sum,
      fundedfantom:sum2,
      goal:results.get('goal'), 
      summary:summary, 
      watchers:userss.length
    };
});

Parse.Cloud.define('allTransactions', async ({request}:any) => {

  const transactions = new Parse.Query('Transactions');
  transactions.equalTo('project', request.params.id);
  const trx = await transactions.find(); //get each transactions
  
  const trans:Array<object> = [];

  for(let fh=0;fh<trx.length;fh++){
    const each = trx[fh];
    const am = each.get('amount');
    const sender = each.get('sender');
    const network = each.get('network');

    trans.push({sender:sender, amount:am, network:network});
  }

  return trans
});

//AFTER A SUCCESSFUL TRANSACTION
Parse.Cloud.define("notify", async ({info}:any) => {
  const par = info.params;
  //info.param = {project id, project name}
  //ALWAYS REMEMBER ETH IS THE CURRENCY OF WEB3

   //SAVING TRANSACTION TO HIS ACCOUNT
   const qw = new Parse.Query('users');
   qw.equalTo('username', par.user); //get the user using the id linking his private to his public account
   const results = await qw.first();

   const username = results.get('username');

   //VALIDATE PROJECT'S EXISTENCE AGAIN
  const proje = new Parse.Query('Projects');
  await proje.get(info.params.id).then(async (wwg:any)=>{

    const Transactions = Parse.Object.extend('Transactions');
    const trans = new Transactions();
    
    trans.set('sender', username);
    trans.set('project', par.id);
    trans.set('network', par.network);
    trans.set('amount', Number(par.amount));
 
    await trans.save(null, {useMasterKey:true}).then(()=>{

   results.addUnique('projects_backed', par.id);

   results.save();
  })

    const notifs = Parse.Object.extend('Notifications');
    const note = new notifs();

    note.set('message', `<div class="notifs" onclick="openproject('${wwg.id}')"><a onclick="openuser('${username}')">@${username}</a> Sent you ${(info.params.am).toString()}eth</div>`);
    note.set('to', wwg.get('idu'));
    note.set('type', 'transaction');

    await note.save(null, {useMasterKey:true})
  });
  
  return true
}/*,

{
  fields: {receiver:{required:true, type:String}, id:{required:true, type:String}, amount:{required:true, type:String}, user:{required:true, type:String}},
  requireUser: true,
}*/);


// LIKED AND BE LIKED SECTION... COMPLETED
Parse.Cloud.define("like", async (request:any) => {
  let post = new Parse.Object("Posts");
  post.id = request.params.postId;
  if(request.params.wh == 'add'){post.addUnique('likes', request.params.username)}
  else{ post.remove('likes', request.params.username)}

  await post.save(null, { useMasterKey: true });
  return 'done';
});

Parse.Cloud.define("quote", async (request:any) => {
  let post = new Parse.Object("Posts");
  post.id = request.params.postId;
  if(request.params.wh == 'add'){post.addUnique('quotes', request.params.username)}
  else{post.remove('quotes', request.params.username)}

  await post.save(null, { useMasterKey: true });
  return 'done'
});

Parse.Cloud.define("like_comment", async (request:any) => {
  let post = new Parse.Query("Comments");
  post.get(request.params.postId).then(async (post:any)=>{
    if(request.params.wh == 'add'){post.addUnique('likes', request.params.username)}
    else{ post.remove('likes', request.params.username)}
  
  await post.save(null, { useMasterKey: true });
  return 'done'
});
});
///

///A SIMPLE CLOUD CODE TO IMPORT USERINFO
Parse.Cloud.define('userinfo', async (request:any) => {
  //all will be returned in numbers.
  //projects created by user
  const projects = new Parse.Query('Projects');
  projects.equalTo('idu', request.params.user);
  const pcount = await projects.find();

  //how many supporters the user has
  let bcount = 0;
  if(pcount>0){
  for(let de = 0; de<pcount.length; de++){
    const stu = new Parse.Query('users');
    stu.equalTo('projects_backed', pcount[de].id);
    const ui = await stu.find();
    bcount+=ui.length
  }
}
  //numbers of projects supported by the user him/her self
  const ryy = new Parse.Query('users');
  ryy.equalTo('username', request.params.user);
  const supd = await ryy.first();

  return {projects:pcount.length, backers:bcount, supported:supd.get('projects_backed').length}
});
///USER SIMPLE QUERY


Parse.Cloud.define('notifications', async (request:any) => {
  const notif = new Parse.Query('Notifications');
  notif.equalTo('to', request.params.userSelf);
  const results = await notif.find({useMasterKey:true});

  const allnotifs:Array<object> = [];
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


Parse.Cloud.afterSave('Posts', async (req:any) => {
  const referredTo = req.context.referredto;
  //if the post refers to a certain project, it will be linked to it, and this will notify the people watching said project.
  const users = new Parse.Query('users');
  users.containedIn('watchlist', referredTo); //select those who have the post in their watchlist
  await users.find().then(async (the_users:any)=>{
    //notify each user. fields... to=username. for=project. message=message and from:poster in html
    const message = 'A Post on this project was posted by user x';
    for(let ryu = 0; ryu<the_users.length;ryu++){
      //send notification to each user
      const notifs = Parse.Object.extend('Notifications');
      const note = new notifs();
  
      note.set('message', `<div onclick="openpost('${req.context.pid}')"><a onclick="openuser('${req.context.uI.username}')">@${req.context.uI.username}</a> replied to your comment in a post</div>`);
      note.set('to', the_users.get('username'));
      note.set('type', 'post');

      await note.save(null, {useMasterKey:true})
    }
  },
  (error:any)=>{
    //there wasnt any users watching it
  }
  )
});


Parse.Cloud.afterSave('Comments', async (req:any) => {
  const commenter = req.context.uI;
  if(req.context.comid != ''){
    const comments = new Parse.Query('Comments');
    comments.get(req.context.comid).then((cobj:any)=>{

      const notifs = Parse.Object.extend('Notifications');
      const note = new notifs();
  
      note.set('message', `<div onclick="openpost('${req.context.pid}')"><a onclick="openuser('${req.context.uI.username}')">@${req.context.uI.username}</a> replied to your comment in a post</div>`);
      note.set('to', cobj.get('idu'));
      note.set('type', 'comment');

      note.save(null, {useMasterKey:true})
    })
  }

  const posts = new Parse.Query('Post');
  posts.get(req.context.pid).then((obj:any)=>{
    const notifs = Parse.Object.extend('Notifications');
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
