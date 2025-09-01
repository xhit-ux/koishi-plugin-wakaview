import { Context, Schema, h } from 'koishi'
import axios from 'axios'
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas'
import path from 'path'
import fs from 'fs'

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

        // 获取用户头像 URL
        const avatarUrl = await getAvatarUrl(username)

        // 尝试加载自定义字体，如果失败则使用系统字体
        try {
          const fontPath = path.join(__dirname, '../assets/fonts/VarelaRound-Regular.ttf')
          if (fs.existsSync(fontPath)) {
            GlobalFonts.registerFromPath(fontPath, 'Rounded')
          } else {
            console.log('[wakatime] [WARN] 字体文件不存在，使用系统字体')
          }
        } catch (fontError) {
          console.log('[wakatime] [WARN] 字体加载失败，使用系统字体:', fontError.message)
        }

        // 创建 Canvas
        const canvasWidth = 500
        const canvasHeight = 320
        const canvas = createCanvas(canvasWidth, canvasHeight)
        const ctx = canvas.getContext('2d')

        // 背景
        ctx.fillStyle = '#696969'
        ctx.fillRect(0, 0, canvasWidth, canvasHeight)

        // 圆角矩形背景
        const x = 30
        const y = 85
        const width = 435
        const height = 210
        const radius = 20

        ctx.fillStyle = '#ffb6c1'
        ctx.beginPath()
        ctx.moveTo(x + radius, y)
        ctx.arcTo(x + width, y, x + width, y + height, radius)
        ctx.arcTo(x + width, y + height, x, y + height, radius)
        ctx.arcTo(x, y + height, x, y, radius)
        ctx.arcTo(x, y, x + width, y, radius)
        ctx.closePath()
        ctx.fill()

        // 设置文字样式 - 直接使用字体回退机制
        const fontFamily = 'Rounded' // 浏览器会自动回退到可用字体
        
        // 用户 & 时间
        ctx.fillStyle = '#ffffff'
        ctx.font = `20px ${fontFamily}`
        ctx.textBaseline = 'top' // 设置文字基线
        ctx.fillText(`User: ${username}`, 50, 25)
        ctx.fillText(`Total coding time: ${totalCodingHours} hrs`, 50, 55)

        // Top 5 标题
        ctx.fillStyle = '#000000'
        ctx.font = `18px ${fontFamily}`
        ctx.fillText('Top 5 language time:', 50, 100)

        // 语言条形图
        const barStartX = 50
        const barStartY = 140
        const barHeight = 10
        const barMaxWidth = 400
        const barRadius = barHeight / 2

        const colors = ['#ff4b5c', '#ffab00', '#4caf50', '#42a5f5', '#9c27b0']

        topLanguages.forEach((lang, index) => {
          const langTime = lang.total_seconds / 3600
          const percentage = lang.total_seconds / totalCodingTime
          const barWidth = Math.max(percentage * barMaxWidth, 5)

          // 语言名称和时间
          ctx.fillStyle = '#000000'
          ctx.font = `14px ${fontFamily}`
          ctx.fillText(`${lang.name}: ${langTime.toFixed(2)} hrs`, barStartX, barStartY + index * 30 - 15)

          // 背景条
          ctx.fillStyle = '#d3d3d3'
          ctx.beginPath()
          ctx.roundRect(barStartX, barStartY + index * 30, barMaxWidth, barHeight, barRadius)
          ctx.fill()

          // 渐变条
          const gradient = ctx.createLinearGradient(barStartX, 0, barStartX + barWidth, 0)
          gradient.addColorStop(0, colors[index % colors.length] + '80')
          gradient.addColorStop(1, colors[index % colors.length])

          ctx.fillStyle = gradient
          ctx.beginPath()
          ctx.roundRect(barStartX, barStartY + index * 30, barWidth, barHeight, barRadius)
          ctx.fill()
        })

        // 用户头像
        if (avatarUrl) {
          try {
            const avatarImage = await loadImage(avatarUrl)
            const avatarSize = 80
            const avatarX = 370
            const avatarY = 20
            const cornerRadius = 10

            ctx.save()
            ctx.beginPath()
            ctx.moveTo(avatarX + cornerRadius, avatarY)
            ctx.arcTo(avatarX + avatarSize, avatarY, avatarX + avatarSize, avatarY + avatarSize, cornerRadius)
            ctx.arcTo(avatarX + avatarSize, avatarY + avatarSize, avatarX, avatarY + avatarSize, cornerRadius)
            ctx.arcTo(avatarX, avatarY + avatarSize, avatarX, avatarY, cornerRadius)
            ctx.arcTo(avatarX, avatarY, avatarX + avatarSize, avatarY, cornerRadius)
            ctx.closePath()
            ctx.clip()

            ctx.drawImage(avatarImage, avatarX, avatarY, avatarSize, avatarSize)
            ctx.restore()
          } catch (avatarError) {
            console.log('头像加载失败:', avatarError.message)
          }
        }

        // 水印
        const currentTime = new Date().toLocaleString('zh-CN')
        ctx.save()
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
        ctx.font = `12px ${fontFamily}`
        ctx.textBaseline = 'bottom'
        ctx.fillText(currentTime, 10, canvasHeight - 5)
        ctx.restore()

        // 输出图片
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
  try {
    // 先检查头像是否存在
    const response = await axios.head(`https://wakatime.com/photo/@${username}`)
    if (response.status === 200) {
      return `https://wakatime.com/photo/@${username}`
    }
  } catch (error) {
    console.log('无法获取用户头像')
  }
  return null
}