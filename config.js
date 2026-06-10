// Trading Journal Web — configuration
//
// CLIENT_ID must be a "Web application" OAuth client created in the SAME
// Google Cloud project as the iOS app's client (528474867568-…), otherwise
// the drive.file scope cannot see the journal.db the iPhone uploaded.
const CONFIG = {
  CLIENT_ID: '528474867568-lm6704o7nd298c5opff4lt9giocp3415.apps.googleusercontent.com',
  SCOPE: 'https://www.googleapis.com/auth/drive.file',
  FOLDER_NAME: 'TradingJournalSync',
  DB_FILE_NAME: 'journal.db',
};
