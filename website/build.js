'use strict'

const fs = require('fs')
const path = require('path')
const ejs = require('ejs')
const marked = require('marked')
const mkdirp = require('mkdirp')
const cssnext = require('cssnext')
const hjs = require('highlight.js')
const pkg = require('../package.json')
const minifier = require('html-minifier')
const minify = minifier.minify


const start = Date.now()

const outputPath = path.join(__dirname, '../dist')

const template = fs.readFileSync(
  path.join(__dirname, 'template.ejs')).toString()

const readme = fs.readFileSync(
  path.join(__dirname, '../README.md')).toString()

const renderer = new marked.Renderer()

renderer.heading = (text, level) => {
  const escapedText = text.toLowerCase().replace(/[^\w]+/g, '-')
  return `<h${level} id="${escapedText}">${text}<a class="anchor" ` +
    `href="#${escapedText}" title="Link to this section “${text}”">#</a>` +
    `</h${level}>`
}

const text = (/(## Usage([\s\S]+)(?=))/g).exec(readme)[1]
const html = marked(text, {
  renderer, highlight: code => hjs.highlightAuto(code).value
})

mkdirp.sync(outputPath)
fs.writeFileSync(path.join(outputPath, 'index.html'), minify(
  ejs.render(template, {
    name: pkg.name,
    description: pkg.description,
    content: html
  }),
  { collapseWhitespace: true }
))


const cssIndex = path.join(__dirname, 'index.css')

fs.writeFileSync(path.join(outputPath, 'index.css'),
  cssnext(fs.readFileSync(cssIndex).toString(), {
    compress: true, from: cssIndex
  }))


process.stdout.write(`Build completed in ${(Date.now() - start) / 1000} s.\n`)