class Target{
    
    constructor(maxX,maxY, color, size){
        this.position = {x:0, y:0};        
        this.color = color;
        this.size = size;

        this.newRandomPos(maxX,maxY);
    }

    newRandomPos(maxX, maxY) {
        const getRandomInt = (max) => {
            return Math.floor(this.size + Math.random() * (max - 2 * this.size));
        }

        this.newPos(getRandomInt(maxX), getRandomInt(maxY));
    }

    newPos(x, y) {
        this.x = x;
        this.y = y;
        this.position.x = x;
        this.position.y = y;
    }
}