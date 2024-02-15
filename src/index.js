const cfg = (ctx) => {
  let userConfig = ctx.getConfig('picBed.csdn-uploader')
  if (!userConfig) {
    userConfig = {}
  }
  const config = [
    {
      name: 'account',
      type: 'input',
      default: userConfig.account || '',
      message: '账户不能为空',
      required: true
    },
    {
      name: 'password',
      type: 'input',
      default: userConfig.password || '',
      message: '密码不能为空',
      required: true
    }
  ]
  return config
}


const handle = async ctx => {
  let output = ctx.output


  function buildUploadOptions (base64Image,upCrt) {
    return {
      method: 'POST',
      url: `http://upload-${upCrt.Region}.qiniup.com/putb64/-1`,
      headers: {
        Authorization: `UpToken ${upCrt.UpToken}`,
        'Content-Type': 'application/octet-stream'
      },
      body: base64Image
    }
  }

  async function getUploadToken(fileName, accessToken) {
    const uploadTokenUrl = 'https://img.api.amgl.work/getUploadToken';

    var fileTypeMap = {
      'jpg': 0,
      'jpeg': 1,
      'png': 2,
      'gif': 3,
      'svg': 4,
      'webp': 5,
    };

    // 提取文件后缀
    const lastDotIndex = fileName.lastIndexOf('.');
    let fileExtension = '';
    if (lastDotIndex !== -1) {
      fileExtension = fileName.slice(lastDotIndex + 1).toLowerCase();
    }

    let fileType = -1;
    if (fileExtension && fileTypeMap.hasOwnProperty(fileExtension)) {
      fileType = fileTypeMap[fileExtension];
    } else {
      throw new Error("不支持的文件类型");
    }

    // 处理未包含后缀的文件名
    if (!fileExtension) {
      throw new Error("没有获取到文件类型");
    }

    try {
      const response = await ctx.request({
        method: 'GET',
        url: `${uploadTokenUrl}?type=${fileType}`,
        headers: {
          Authorization: `Bearer id_token="${accessToken}"`
        }
      });
      return response;
    } catch (error) {
      throw new Error(error.message);
    }
  }


  async function getAccessToken(email, password) {
    const authUrl = 'https://img-amgl.authing.cn/api/v3/signin';

    const data = {
      "connection": "PASSWORD",
      "passwordPayload": {
        "email": email,
        "password": password
      }
    };

    try {
      const response = await ctx.request({
        method: 'POST',
        url: authUrl,
        headers: {
          'X-Authing-App-Id': '65cb8b6d58ce57fb865b4daa',
          'X-Authing-Userpool-Id': '65cb6689b031f6b8302113f7',
          'User-Agent': 'Apifox/1.0.0 (https://apifox.com)',
          'Content-Type': 'application/json',
          'Accept': '*/*',
          'Host': 'img-amgl.authing.cn',
          'Connection': 'keep-alive',
          'Referer': 'http://img-amgl.authing.cn/api/v3/signin'
        },
        data: JSON.stringify(data)
      });

      if (response.statusCode === 200) {
        return response.data.access_token;
      } else {
        throw new Error(response.message);
      }

    } catch (error) {
      throw new Error(error.message);
    }
  }

  //获取用户配置信息
  let userConfig = ctx.getConfig('picBed.img-amgl');
  //登录账户
  const accessToken = await getAccessToken(userConfig.account,userConfig.password);

  try {
    const imgList = ctx.output
    for (const img of imgList) {
      if (img.fileName && img.buffer) {
        const upCrt = await getUploadToken(img.fileName,accessToken);
        const base64Image = img.base64Image || Buffer.from(img.buffer).toString('base64');
        const options = buildUploadOptions(base64Image, upCrt);
        const res = await ctx.request(options);
        const data = JSON.parse(res);
        const imgUrl = data.url;
        img.imgUrl = `${imgUrl}`;
        img.url = `${imgUrl}`;
      }
    }
    return ctx
  } catch (err) {
    if (err.message !== 'Upload failed') {
      // err.response maybe undefined
      if (err.response) {
        const error = err.response.body
        ctx.emit("notification", {
          title: "上传失败",
          body: error.error
        })
      }
    }
    throw err
  }

}

module.exports = ctx => {
  const register = () => {
    ctx.helper.uploader.register('img-amgl', {
      handle,
      config: cfg
    })
  }
  return {
    register,
    uploader: 'img-amgl'  // 请将uploader的id注册在这里
  }
}