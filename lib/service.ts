import puppeteer, { Page, ElementHandle } from 'puppeteer'
import {
    LAST_CONVERSATION_MESSAGES_STATUS_SELECTOR,
    NEW_CONVERSATION_URL,
} from './constants'

type Conversation = {
    unread: boolean, 
    id: number,
    timestamp: string, 
    from: string, 
    latestMsgText: string
}

class MessageService {
    private page: Page
    constructor (page: Page) {
        this.page = page
    }

    async getInbox() {
        // TODO: add pagination
        await this.page.waitForNavigation({ waitUntil: 'load' })
        await this.page.waitForSelector('body > mw-app > mw-bootstrap > div > main > mw-main-container > div > mw-main-nav > mws-conversations-list > nav > div.conv-container.ng-star-inserted > mws-conversation-list-item')

        const inbox = await this.page.evaluate(() => {
            function evalConvoElement (conversation: Element) {
                const props: Conversation = {
                    unread: false, // querySelector find .unread class
                    id: 0, // href of a tag
                    timestamp: '', // mws-relative-timestamp .innerText || > ..ng-star-inserted').getAttribute('aria-label') if latest message
                    from: '', // querySelector('h3').innerText
                    latestMsgText: '' // querySelector('mws-conversation-snippet').innerText
                }
                props.unread = conversation.querySelector('.unread') ? true : false
                
                const regex = /conversations\/(\d{1,})/g
                const chatUrl = conversation.querySelector('a').href
                props.id = parseInt(chatUrl.match(regex)[0].split('conversations/')[1])
                
                if (conversation.querySelector('mws-relative-timestamp').childElementCount > 0) {
                    props.timestamp = conversation.querySelector('mws-relative-timestamp > .ng-star-inserted').getAttribute('aria-label')
                } else {
                    props.timestamp = (conversation.querySelector('mws-relative-timestamp') as HTMLElement).innerText
                }

                props.from = conversation.querySelector('h3').innerText
                props.latestMsgText = (conversation.querySelector('mws-conversation-snippet') as HTMLElement).innerText
                if (props.latestMsgText.startsWith('You:')) {
                    props.latestMsgText = props.latestMsgText.slice('You:'.length).trim()
                }
                return props
            }

            const conversations = document.querySelectorAll("body > mw-app > mw-bootstrap > div > main > mw-main-container > div > mw-main-nav > mws-conversations-list > nav > div.conv-container.ng-star-inserted > mws-conversation-list-item")
            const msgs = []
            for (const conversation of conversations) {
                if (conversation) {
                    msgs.push(evalConvoElement(conversation))
                }
            }
            return msgs
        })
        return inbox
    }

    async sendMessage (to: string, text: string) {
        console.log('URL', this.page.url(), NEW_CONVERSATION_URL)
        if (this.page.url() !== NEW_CONVERSATION_URL) {
            const newChatBtn = await this.page.$('body > mw-app > mw-bootstrap > div > main > mw-main-container > div > mw-main-nav > div > mw-fab-link > a');
            await newChatBtn.click();
            // Not waiting for page loaded!
        }
        // await page.waitForSelector()
        // const numberInput = await page.$eval('#mat-chip-list-2 > div > input', (input) => {
        //     console.log(input)
        // })
        // const numberInput = await page.$('#mat-chip-list-2 > div > input')
        try {
            await this.page.waitForXPath('//mat-chip-listbox/span/input', { timeout: 5000 })
        } catch (err) { }
        // await page.waitForTimeout(2 * 1000) // remove lateer
        // await this.page.waitForXPath('//mat-chip-listbox/span/input')
        let numberInput = await this.page.$x('//mat-chip-listbox/span/input')
        // console.log('NumberInput', numberInput)
        if (numberInput.length) {
            await numberInput[0].type(to)
            // numberInput.type(String.fromCharCode(13))
            await this.page.waitForXPath('/html/body/mw-app/mw-bootstrap/div/main/mw-main-container/div/mw-new-conversation-container/div/mw-contact-selector-button/button')
            const contactBtn = await this.page.$x('/html/body/mw-app/mw-bootstrap/div/main/mw-main-container/div/mw-new-conversation-container/div/mw-contact-selector-button/button')
            await (contactBtn[0] as ElementHandle<Element>).click()
        }
        // await page.waitForSelector('body > mw-app > mw-bootstrap > div > main > mw-main-container > div > mw-conversation-container > div.container.ng-tns-c39-541.ng-star-inserted > div > mws-message-compose > div > div.input-box > div > mws-autosize-textarea > textarea', { visible: true })
        try {
            await this.page.waitForXPath('/html/body/mw-app/mw-bootstrap/div/main/mw-main-container/div/mw-conversation-container/div[1]/div[1]/div/mws-message-compose/div/div[2]/div/mws-autosize-textarea/textarea')
        } catch (err) {  }
        // await page.waitForTimeout(2 * 1000) // remove lateer
        let msgInput = await this.page.$x('/html/body/mw-app/mw-bootstrap/div/main/mw-main-container/div/mw-conversation-container/div[1]/div[1]/div/mws-message-compose/div/div[2]/div/mws-autosize-textarea/textarea')
        // console.log('MsgINput', msgInput)
        if (msgInput.length) {
            await msgInput[0].type(text)
            this.page.keyboard.press('Enter');
            await this.page.waitForXPath(LAST_CONVERSATION_MESSAGES_STATUS_SELECTOR);
            console.log('El estado del mensaje', this.page.$x(LAST_CONVERSATION_MESSAGES_STATUS_SELECTOR));
        } else {
            this.page.reload()
            console.warn('retrying...')
            this.sendMessage(to, text)
        }
        // TODO: return messageId
        return 
    }
}

export default MessageService
