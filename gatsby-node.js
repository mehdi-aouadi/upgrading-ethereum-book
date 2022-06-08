const path = require('path')
const execSync = require('child_process').execSync;
const markdownlint = require('markdownlint')
const glob = require('glob')

// Set up a hook to pre-process the source file into split files, and perform various
// checking and linting operations prior to building.
exports.onPreInit = ({reporter}) => {

  const sourceMarkdown = 'src/book.md'
  const splitMarkdown = glob.sync('src/md/**/*.md', {'ignore': 'src/md/annotated.md'})
  var sourceLintSucceeded = false

  reporter.info('Checking internal links...')
  try {
    const out = execSync(`bin/build/links.awk ${sourceMarkdown} ${sourceMarkdown}`, {encoding: 'utf8'})
    if (out !== '') {
      reporter.warn('Found some bad internal links:')
      out.split(/\r?\n/).forEach((line, i) => reporter.warn(line))
    }
  } catch (err) {
    reporter.warn('Unable to check internal links:')
    err.toString().split(/\r?\n/).forEach((line, i) => reporter.warn(line))
  }

  reporter.info('Lint checking source markdown...')
  try {
    const out = lintSourceMarkdown(sourceMarkdown)
    if (out !== null) {
      reporter.warn('Found some linting issues:')
      out.split(/\r?\n/).forEach((line, i) => reporter.warn(line))
    } else {
      sourceLintSucceeded = true
    }
  } catch (err) {
    reporter.warn('Unable to lint check source markdown:')
    err.toString().split(/\r?\n/).forEach((line, i) => reporter.warn(line))
  }

  reporter.info('Performing spellcheck...')
  try {
    const out = execSync(`bin/build/spellcheck.sh ${sourceMarkdown} bin/build/spellcheck_my_words.txt`, {encoding: 'utf8'})
    if (out !== '') {
      reporter.warn('Found some misspellings:')
      out.split(/\r?\n/).forEach((line, i) => reporter.warn(line))
    }
  } catch (err) {
    reporter.warn('Unable to perform spellcheck:')
    err.toString().split(/\r?\n/).forEach((line, i) => reporter.warn(line))
  }

  reporter.info('Unpacking book source...')
  try {
    execSync('bin/build/update.sh')
  } catch (err) {
    reporter.panic('Failed to unpack book source.', err)
  }

  // To keep the noise down we do this check only if the source check passed
  if (sourceLintSucceeded) {
    reporter.info('Lint checking split markdown...')
    try {
      const out = lintSplitMarkdown(splitMarkdown)
      if (out !== null) {
        reporter.warn('Found some linting issues:')
        out.split(/\r?\n/).forEach((line, i) => reporter.warn(line))
      }
    } catch (err) {
      reporter.warn('Unable to lint check split markdown:')
      err.toString().split(/\r?\n/).forEach((line, i) => reporter.warn(line))
    }
  } else {
    reporter.warn('Skipping lint checking of split markdown do to earlier errors.')
  }
}

exports.createPages = async ({ actions, graphql }) => {
  const { createPage } = actions
  const pageTemplate = path.resolve(`src/templates/pageTemplate.js`)

  const result = await graphql(`
    {
      allMarkdownRemark {
        edges {
          node {
            frontmatter {
              path
            }
          }
        }
      }
    }
  `)

  if (result.errors) {
    reporter.panicOnBuild(`Error while running GraphQL query.`)
  }

  result.data.allMarkdownRemark.edges.forEach(({ node }) => {
    createPage({
      path: node.frontmatter.path,
      component: pageTemplate,
    })
  })
}

// Lint check the source markdown file.
function lintSourceMarkdown(file) {

  const options = {
    'files': [ file ],
    'config': {
      'default': true,
      'line-length': false,

      // Start unordered lists with two spaces of indentation
      'MD007': {
        'indent': 2,
        'start_indented': true,
        'start_indent': 2,
      },

      // We don't want any trailing spaces
      'MD009': {
        'strict': true,
      },

      // Some headings end in ! or ?
      'MD026': {
        'punctuation': '.,;:',
      },

      // Emphasis style
      'MD049': {
        'style': 'underscore',
      },

      // We have long lines
      'MD013': false,

      // Duplicate headings are ok (they appear on different pages after pre-processing)
      'MD024': false,

      // Multiple top-level titles are ok (they appear on different pages after pre-processing)
      'MD025': false,

      // We have inline html
      'MD033': false,

      // no-space-in-emphasis Spaces inside emphasis markers - gives false positives
      'MD037': false,

      // no-space-in-code Spaces inside code span elements
      // it's sometimes useful to do this, but we may want to look at workarounds
      'MD038': false,

      // We mix code block notations since we sometimes don't want pretty-printing
      'MD046': false,
    }
  }

  const result = markdownlint.sync(options)

  return (result[file].length > 0) ? result.toString() : null
}

// Lint check the markdown files after they have been split out from the source document.
// The rules differ slightly from the rules for the original source.
function lintSplitMarkdown(files) {

  const options = {
    'files': files,
    'config': {
      'default': true,
      'line-length': false,

      // Start unordered lists with two spaces of indentation
      'MD007': {
        'indent': 2,
        'start_indented': true,
        'start_indent': 2,
      },

      // We don't want any trailing spaces
      'MD009': {
        'strict': true,
      },

      // Some headings end in ! or ?
      'MD026': {
        'punctuation': '.,;:',
      },

      // Emphasis style
      'MD049': {
        'style': 'underscore',
      },

      // Trailing blank lines are hard to avoid when doing the split
      'MD012': false,

      // We have long lines
      'MD013': false,

      // We have inline html
      'MD033': false,

      // no-space-in-emphasis Spaces inside emphasis markers - gives false positives
      'MD037': false,

      // no-space-in-code Spaces inside code span elements
      // it's sometimes useful to do this, but we may want to look at workarounds
      'MD038': false,

      // We don't expect the very first line to be a top-level heading (due to inserted <div>)
      'MD041': false,

      // We mix code block notations since we sometimes don't want pretty-printing
      'MD046': false,
    }
  }

  const result = markdownlint.sync(options)

  return (Object.values(result).filter(x => x.length > 0).length > 0)
    ? result.toString()
    : null
}
