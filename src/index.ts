import { Context, Schema, h } from 'koishi'
import axios from 'axios'
import { createCanvas, loadImage, registerFont } from 'canvas'
import path from 'path'

export const name = 'wakaview'

export interface Config {}

export const Config: Schema<Config> = Schema.object({})

export function apply(ctx: Context) {
  ctx.command('wakatime <username:string>', '查询 Wakatime 用户总代码时长和常用语言')
    .action(async ({ session }, username: string) => {
      if (!username) return '请提供 Wakatime 用户名！'

      try {
        // 获取 Wakatime 数据
        
        const res = await axios.get(`https://wakatime.com/api/v1/users/${username}/stats`)
        if (res.data.error) {
          return '请检查用户名'
        }

        const data = res.data.data

        // 获取总编码时间
        const totalCodingTime = data.categories.find(category => category.name === 'Coding')?.total_seconds || 0
        if (totalCodingTime === 0) {
          return `用户 ${username} 没有可用的编码数据。`
        }
        const totalCodingHours = (totalCodingTime / 3600).toFixed(2)

        // 获取 Top 5 语言
        const topLanguages = (data.languages || [])
          .sort((a, b) => b.total_seconds - a.total_seconds)
          .slice(0, 5)

        if (topLanguages.length === 0) {
          return `用户 ${username} 没有可用的编码数据。`
        }

        // 获取用户头像 URL（通过 Wakatime API 用户页面获取）
        const avatarUrl = await getAvatarUrl(username)

        // 加载 **项目内的** 圆体字体
        const fontPath = path.resolve(__dirname, '../assets/fonts/VarelaRound-Regular.ttf')
        registerFont(fontPath, { family: 'Rounded' })

        // 创建 Canvas
        const canvasWidth = 500
        const canvasHeight = 320
        const canvas = createCanvas(canvasWidth, canvasHeight)
        const ctx = canvas.getContext('2d')

        // 绘制背景
        ctx.fillStyle = '#696969'
        ctx.fillRect(0, 0, canvasWidth, canvasHeight)

        // 在 (100, 30) 到 (307, 420) 区间绘制亮黄色圆角矩形背景
        const x = 30;  // 矩形的左上角 x 坐标
        const y = 85;   // 矩形的左上角 y 坐标
        const width = 435;  // 矩形的宽度 (307 - 100)
        const height = 210; // 矩形的高度 (420 - 30)
        const radius = 20;  // 圆角的半径

        // 设置亮黄色
        ctx.fillStyle = '#ffb6c1'  // 亮黄色
        ctx.beginPath()
        ctx.moveTo(x + radius, y) // 将路径移动到矩形的左上角起点
        ctx.arcTo(x + width, y, x + width, y + height, radius) // 圆角
        ctx.arcTo(x + width, y + height, x, y + height, radius) // 圆角
        ctx.arcTo(x, y + height, x, y, radius) // 圆角
        ctx.arcTo(x, y, x + width, y, radius) // 圆角
        ctx.closePath()
        ctx.fill() // 填充颜色


        // 设置字体
        ctx.fillStyle = '#ffffff'
        ctx.font = '20px Rounded'
        ctx.fillText(`User: ${username}`, 50, 45)
        ctx.fillText(`Total coding time: ${totalCodingHours} hrs`, 50, 75)

        // 进度条起点
        const barStartX = 50
        const barStartY = 140
        const barHeight = 10 // 进度条高度减少一半
        const barMaxWidth = 400
        const barRadius = barHeight / 2 // 圆角半径

        ctx.fillStyle = '#000000'
        ctx.font = '20px Rounded'
        ctx.fillText('Top 5 language time:\n', 50, 110)

        // 颜色数组
        const colors = ['#ff4b5c', '#ffab00', '#4caf50', '#42a5f5', '#9c27b0']

        // 绘制进度条
        topLanguages.forEach((lang, index) => {
          const langTime = lang.total_seconds / 3600
          const percentage = lang.total_seconds / totalCodingTime
          const barWidth = Math.max(percentage * barMaxWidth, 5) // 确保进度条不会太小

          // 语言名
          ctx.fillStyle = '#000000'
          ctx.font = '16px Rounded'
          ctx.fillText(`${lang.name}: ${langTime.toFixed(2)} hrs`, barStartX, barStartY + index * 35 - 5)

          // 进度条背景（浅灰色）
          ctx.fillStyle = '#d3d3d3'
          ctx.beginPath()
          ctx.roundRect(barStartX, barStartY + index * 35, barMaxWidth, barHeight, barRadius)
          ctx.fill()

          // 渐变进度条（从左到右颜色加深）
          const gradient = ctx.createLinearGradient(barStartX, barStartY + index * 35, barStartX + barWidth, barStartY + index * 35)
          gradient.addColorStop(0, colors[index % colors.length] + '80') // 浅色（透明度 50%）
          gradient.addColorStop(1, colors[index % colors.length]) // 深色

          ctx.fillStyle = gradient
          ctx.beginPath()
          ctx.roundRect(barStartX, barStartY + index * 35, barWidth, barHeight, barRadius)
          ctx.fill()
        })

        // 绘制用户头像（右上角，圆角）
        if (avatarUrl) {
          const avatarImage = await loadImage(avatarUrl)
          const avatarSize = 90
          const avatarX = 360
          const avatarY = 20
          const cornerRadius = 10

          ctx.save()
          ctx.beginPath()
          ctx.moveTo(avatarX + cornerRadius, avatarY)
          ctx.arcTo(avatarX + avatarSize, avatarY, avatarX + avatarSize, avatarY + avatarSize, cornerRadius)  // 右上角
          ctx.arcTo(avatarX + avatarSize, avatarY + avatarSize, avatarX, avatarY + avatarSize, cornerRadius)  // 右下角
          ctx.arcTo(avatarX, avatarY + avatarSize, avatarX, avatarY, cornerRadius)  // 左下角
          ctx.arcTo(avatarX, avatarY, avatarX + avatarSize, avatarY, cornerRadius)  // 左上角
          ctx.closePath()
        
          // 设置剪切区域
          ctx.clip()
        
          // 绘制头像图片
          ctx.drawImage(avatarImage, avatarX, avatarY, avatarSize, avatarSize)
          ctx.restore()
        }
        // 获取当前时间
        const currentTime = new Date().toLocaleString()  // 获取当前时间，格式可以根据需要调整

        // 设置时间水印样式
        ctx.save()
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'  // 白色并带有透明度
        ctx.font = '12px Rounded'  // 设置字体大小和类型
        ctx.fillText(`${currentTime}`, 10, canvasHeight - 10)  // 在左下角绘制时间水印
        ctx.restore()

        // 生成 Buffer 并返回图片
        const buffer = canvas.toBuffer('image/png')

        await session.send(h.image(buffer, 'image/png'))

      } catch (error) {
        console.error('Wakatime API 访问失败:', error)
        return '获取 Wakatime 数据失败，请检查用户名或稍后重试。'
      }
    })
}

// 获取用户头像 URL
async function getAvatarUrl(username: string) {
  // 直接构造头像 URL
  return `https://wakatime.com/photo/@${username}`
}
