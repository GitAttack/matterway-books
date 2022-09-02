const puppeteer = require('puppeteer')
const prompt = require("prompt-sync")({ sigint: true })

let page

(async () => {
    console.log('\nHello! please stand by while we fetch some book genres')
    const browser = await puppeteer.launch({headless: true})

    try{
    page = await browser.newPage()

    const genres = await getGenres()

    console.log('\nHere are the available genres: ')
    genres.map((genre, i) => 
        console.log('['+(i+1)+'] '+genre.name)
    )

    const selectedGenre = getUserInput(genres)

    console.log('\nNice! You selected: '+selectedGenre.name)
    console.log('Fetching you a book...')

    const rndBookName = await fetchRandomBookName(selectedGenre)

    console.log('\nYour book is: '+rndBookName)
    console.log('Please hold')

    const checkoutPage = await fetchCheckoutPage(rndBookName)

    console.log('\nAlmost done, enjoy your book!')

    await displayCheckoutPage(checkoutPage)
    
    } catch (err) {
       console.log('\nProblem! :) '+err)
    } finally {
        await browser.close()
    }
})()

const getUserInput = (genres) => {
    console.log()
    let userInput = prompt('Please select one: ')
    selectedGenre = isInputGenreValid(genres, userInput)
    if (!selectedGenre){
        console.log("Genre wasn't recognized")
        return getUserInput(genres)
    }
    else return selectedGenre
}

const isInputGenreValid = (genres, selectedGenre) => {
    //Checks if user input correlates to a genre in the list. If true, returns the genre object

    selectedGenre = selectedGenre.toLowerCase()
    let match = false
    genres.map((genre, i) => {
        if (selectedGenre==genre.name.toLowerCase() || selectedGenre==(i+1).toString())
            match = genre
    })
    return match
}

const getGenres = async () => {
    //Returns a list of genres and their related page URLs from Goodreads

    await page.goto('https://www.goodreads.com/choiceawards/best-books-2020',  {waitUntil: 'load'})
    const genres = await page.$$eval('.categoryContainer > .category.clearFix > a', links => 
        links.map(link => 
            ({
                name: link.innerText,
                url: link.href
            })
        )
    )
    return genres
}

const fetchRandomBookName = async (selectedGenre) => {
    //Returns a random book name from the genre page

    await page.goto(selectedGenre.url, {waitUntil: 'load'})

    //Close popup. Puppeteer click() doesn't work so clicking in page context instead
    const closeModalHandle = await page.$('.modal__close button')
    if (closeModalHandle != null) await closeModalHandle.evaluate(b => b.click())

    const booksHandles = await page.$$('.pollContents .inlineblock.pollAnswer.resultShown')
    const randomIndex = Math.floor(Math.random() * booksHandles.length)
    const bookHandle = booksHandles[randomIndex]
    await bookHandle.hover()
    
    const popupHandle = await bookHandle.waitForSelector('section.tooltip.book-tooltip.js-tooltip')
    const bookTitle = await popupHandle.$eval('a.readable', title => title.innerText)
    const bookAuthor = await popupHandle.$eval('a.authorName', author => author.innerText)
    return bookTitle+' '+bookAuthor
}

const fetchCheckoutPage = async (bookName) => {
    //Searches the bookName on Amazon, clicks a link to a physical copy in the first result,
    //adds to cart and returns the page URL and cookies
    //If no physical copy link found, navigates to the product page and returns page URL and cookies

    await page.goto('https://www.amazon.com', {waitUntil: 'load'})
    const searchHandle = await page.$('input#twotabsearchtextbox, input#nav-bb-search')
    await searchHandle.type(bookName)
    await Promise.all([
        searchHandle.press('Enter'),
        page.waitForNavigation()])
    const firstResult = await page.$('span[data-component-type="s-search-results"] div[data-index="1"]')
    const [physicalCopyLink] = await firstResult.$x("//a[contains(., 'Hardcover') or contains(., 'Paperback') or contains(., 'Misc.')]")
    
    if (physicalCopyLink==undefined) {
        console.log("Couldn't find a physical version to buy, displaying other format")
        const firstResultImage = await firstResult.$('span[data-component-type="s-product-image"]')
        await Promise.all([
           firstResultImage.click(),
           page.waitForNavigation()])
    }

    else{
        await Promise.all([
            physicalCopyLink.click(),
            page.waitForNavigation()])
        const cartButton = await page.$('#add-to-cart-button')

        await Promise.all([
            cartButton.click(),
            page.waitForNavigation()])

        //Redirects to checkout page, but user will face login prompt first
        // const checkoutButton = await page.$('input[name="proceedToRetailCheckout"]')
        // await Promise.all([
        //    checkoutButton.click(),
        //    page.waitForNavigation()])  
    }

    return {
        url: await page.url(),
        cookies: await page.cookies()
    }
}

const displayCheckoutPage = async (pageParams) => {
    //Gets a URL and cookies and displays a visible browser

    const url = pageParams.url
    const cookies = pageParams.cookies
    const width = 1000
    const height = 800

    browser = await puppeteer.launch({
        executablePath: "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        headless: false,
        args: ['--window-size='+width+','+height],
    })
    const [page] = await browser.pages()
    page.setViewport({ width:0, height:0 })
    await page.setCookie(...cookies)
    await page.goto(url, {waitUntil: 'load'})
}





