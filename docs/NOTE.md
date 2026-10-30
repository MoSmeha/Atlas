# Atlas implementation

I used Claude Code through its VS Code extension, initially with Claude Opus 5.5 and later Fable 5.1. I designed Atlas's core architecture, defined the tech stack and how the code would be structured, and established the contracts and rules before implementation began. Claude then built the project in roughly 50 smaller units running in parallel while I reviewed results, changed some decisions and adjusted.

The entire process of code implementation took about 19 hours between October 28 and 30, 2026. This included designing the architecture, building the core features, testing and fixing answers, and working on voice support, the Arabic interface, free model providers, and documentation.

My biggest decision was that the AI never does the maths or invents a number. Atlas turns every table into a real database table, so totals and comparisons are worked out by code over every row, and a check throws out any figure the code did not produce. Every answer has the same shape and names the document and page or rows it came from, and when the evidence is not there, Atlas says so rather than guessing.

Atlas searches by exact words and by meaning at once, and reads scanned pages as pictures when they have no text. It works with whichever AI is available: OpenAI, Google's free tier, or a model running on the computer itself. Spoken questions pass through the same checks as typed ones. The code is kept in clear, separate parts joined in one place, and 1,919 automated tests run without an API key or an internet connection.

With more time, I'd put Atlas online so anyone can try it in a browser without installing anything, support more file types such as Word documents and images alongside PDF and Excel, and offer a wider choice of AI providers, such as Claude. I'd also make scanned-page processing cheaper, improve support for different PDF table layouts, and test the free models as thoroughly as the paid ones.
