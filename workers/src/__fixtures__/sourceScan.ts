export const BLACKLIST_IN_COMMENT_ONLY = `// blacklist should not trigger here
const note = "blacklist appears in a string";
`;

export const BLACKLIST_IN_CODE = `function blacklistAddress(address account) public onlyOwner {
  _blacklist[account] = true;
}
`;
